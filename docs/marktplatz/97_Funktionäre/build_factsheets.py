#!/usr/bin/env python3
"""Factsheets der Funktionärsämter: DOCX → PDF und → Import-SQL (UC-041).

Liest jede `*_Factsheet.docx` in diesem Ordner, erzeugt daraus

  1. ein PDF gleichen Namens – **nur wenn keines daliegt**: Die aus Word
     exportierten PDFs von Sandro bleiben, wie sie sind;
  2. `import_kadetten.sql`, das die Ämter samt Belegung in
     `functionary_roles` / `functionary_holders` schreibt (Migration 0070).

Aufruf (aus diesem Ordner):

    python3 build_factsheets.py --club <club_id> [--chrome <pfad>]

Werkzeuge: `pandoc` (Text und HTML aus dem DOCX) und ein Headless-Chromium
für das PDF. Ohne `--chrome` wird die Playwright-Headless-Shell im
Benutzer-Cache gesucht. Die Titel der Ämter stehen in TITLES – im DOCX gibt es
keine Titelzeile, nur der Dateiname sagt, worum es geht.
"""
from __future__ import annotations

import argparse
import glob
import html
import json
import os
import re
import subprocess
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))

# Titel je Datei. Drei stammen aus Sandros Word-PDFs, die übrigen folgen der
# Ämtertabelle in docs/Konzept_Vereinsapp_Gamification.md §4.3.
TITLES: dict[str, str] = {
    "Apotheke": "Apothekenverantwortliche:r",
    "Damentrainer": "Damentrainer:in",
    "Eventorganisatoren": "Eventorganisator:in",
    "GOSU": "Verantwortlicher Kommunikation und Abstimmung GOSU",
    "H1Trainer": "Trainer:in Herren 1",
    "H2Trainer": "Trainer:in Herren 2",
    "Halle_BBC": "Hallenverantwortliche:r BBC",
    "Jubiläum_Festwirtschaft": "OK Jubiläum: Festwirtschaft",
    "Jubiläum_Rahmenprogramm": "OK Jubiläum: Rahmenprogramm",
    "Juniorentrainer": "Juniorentrainer:in",
    "Kassier": "Kassier:in",
    "Kopie von Eventorganisatoren": "Streetfloorball-Verantwortliche:r",
    "Pressechef": "Pressechef:in",
    "Revisor": "Revisor:in",
    "Schiri": "Schiedsrichter:in",
    "Schiriobmann": "Schiedsrichterobmann/-frau",
    "Social_Media": "Social-Media-Verantwortliche:r",
    "Spielsekretär": "Spielsekretär:in",
    "Webmaster": "Webmaster",
}

# Bestehende Ämter, die unter anderem Namen schon im Verein stehen: Der
# Titel-Index ist eindeutig, ein zweites «Kassier» darf nicht entstehen.
RENAMES: dict[str, str] = {"Kassier": "Kassier:in"}

HTML_TEMPLATE = """<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>{title}</title>
<style>
  @page {{ size: A4; margin: 22mm 20mm; }}
  body {{ font-family: Helvetica, Arial, sans-serif; font-size: 11pt; color: #111; }}
  h1 {{ font-size: 22pt; font-weight: 400; margin: 0 0 18pt; }}
  table {{ border-collapse: collapse; width: 100%; margin-bottom: 24pt; }}
  th, td {{ border: 1px solid #222; padding: 6pt 8pt; text-align: center; vertical-align: top; font-size: 10pt; }}
  th {{ font-weight: 400; }}
  p {{ margin: 0 0 10pt; }}
  ul {{ margin: 0 0 18pt; padding-left: 18pt; }}
  li {{ margin-bottom: 4pt; }}
  li strong {{ font-weight: 700; }}
  .contact {{ margin-top: 24pt; }}
</style></head><body>
<h1>{title}</h1>
{body}
</body></html>
"""


def run(cmd: list[str], **kwargs) -> str:
    return subprocess.run(cmd, check=True, capture_output=True, text=True, **kwargs).stdout


def find_chrome(explicit: str | None) -> str | None:
    if explicit:
        return explicit
    pattern = os.path.expanduser(
        "~/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-mac-arm64/chrome-headless-shell"
    )
    matches = sorted(glob.glob(pattern))
    return matches[-1] if matches else None


# --- Lesen ----------------------------------------------------------------

def parse_plain(text: str) -> dict:
    """Zerlegt die Klartext-Fassung eines Factsheets.

    Aufbau jeder Datei: eine Tabelle (Besetzt von / Aufwand / Helferpunkte),
    «Pflichten:» mit Aufzählung, «Ansprechperson: Name».
    """
    lines = text.splitlines()
    holders_cell: list[str] = []
    hours = ""
    points = ""

    grid = [l for l in lines if l.startswith("|")]
    if grid:
        # Grid-Tabelle: mehrzeilige Zellen, Spalten durch «|» getrennt.
        rows = [[c.strip() for c in l.strip("|").split("|")] for l in grid]
        body = [r for r in rows[1:] if r and r[0] and not r[0].startswith("Besetzt")]
        for r in body:
            if r[0]:
                holders_cell.append(r[0])
            if len(r) > 1 and r[1] and not hours:
                hours = r[1]
            elif len(r) > 1 and r[1] and hours and r[1] != hours:
                hours = f"{hours} {r[1]}"
            if len(r) > 2 and r[2] and not points:
                points = r[2]
    else:
        # Einfache Tabelle: eine Datenzeile, Spalten durch ≥2 Leerzeichen.
        started = False
        for l in lines:
            if l.strip().startswith("Besetzt von"):
                started = True
                continue
            if started and l.strip() and not set(l.strip()) <= {"-", " "}:
                cells = re.split(r"\s{2,}", l.strip())
                holders_cell.append(cells[0])
                hours = cells[1] if len(cells) > 1 else ""
                points = cells[2] if len(cells) > 2 else ""
                break

    duties: list[dict] = []
    contact = ""
    in_duties = False
    for l in lines:
        s = l.rstrip()
        if s.strip() == "Pflichten:":
            in_duties = True
            continue
        if s.startswith("Ansprechperson:"):
            contact = s.split(":", 1)[1].strip()
            in_duties = False
            continue
        if not in_duties:
            continue
        if s.startswith("- "):
            title = s[2:].strip()
            if title:
                duties.append({"title": title, "detail": None})
        elif s.startswith("  ") and duties and s.strip():
            d = duties[-1]
            d["detail"] = (d["detail"] + " " if d["detail"] else "") + s.strip()

    return {
        "holders_cell": holders_cell,
        "hours": hours.strip(),
        "points": points.strip(),
        "duties": duties,
        "contact": contact,
    }


def parse_holders(cell: list[str]) -> tuple[list[dict], int]:
    """«Besetzt von» → Inhaber:innen und Zahl der Sitze.

    «Vakant» und «-» sind leere Sitze; «(ad interim)» ist ein Sitz, der
    weiterhin vakant zählt (BR-183); eine Zeile wie «4 Spielsekretär:innen»
    ist eine Zahl, kein Name.
    """
    holders: list[dict] = []
    seats = 0
    seen: set[str] = set()
    for raw in cell:
        line = raw.strip()
        if not line:
            continue
        if re.match(r"^\d+\s", line):
            continue
        interim = "ad interim" in line.lower()
        name = re.sub(r"\(ad interim\)", "", line, flags=re.I)
        name = re.sub(r"^vakant\s*/\s*", "", name, flags=re.I).strip()
        if line == "-" or re.match(r"^vakant", name, re.I) or not name:
            seats += 1
            continue
        if name in seen:
            continue
        seen.add(name)
        holders.append({"display_name": name, "interim": interim})
        seats += 1
    return holders, max(seats, 1)


# --- Schreiben ------------------------------------------------------------

def object_name(filename: str) -> str:
    """Dateiname im Vereinsspeicher: ASCII, ohne Leerzeichen.

    Der Schlüssel eines Storage-Objekts steht in Pfaden und Policies; Umlaute
    und Leerzeichen sind dort nur Fehlerquellen.
    """
    name = unicodedata.normalize("NFC", filename)
    for src, dst in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("Ä", "Ae"), ("Ö", "Oe"), ("Ü", "Ue"), ("ß", "ss")):
        name = name.replace(src, dst)
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", name)


def sql_text(value: str | None) -> str:
    if value is None or value == "":
        return "null"
    return "'" + value.replace("'", "''") + "'"


def build_pdf(docx: str, pdf: str, title: str, chrome: str) -> None:
    body = run(["pandoc", docx, "-t", "html", "--wrap=none"])
    # Der Fettdruck der Pflicht-Titel überlebt pandoc; eine leere Aufzählung
    # («- » ohne Text) nicht – die soll auch nicht ins PDF.
    body = re.sub(r"<li>\s*</li>", "", body)
    body = body.replace("<p>Ansprechperson:", '<p class="contact">Ansprechperson:')
    page = HTML_TEMPLATE.format(title=html.escape(title), body=body)
    html_path = pdf[:-4] + ".tmp.html"
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(page)
    try:
        subprocess.run(
            [chrome, "--headless", "--disable-gpu", "--no-sandbox",
             "--no-pdf-header-footer", f"--print-to-pdf={pdf}", "file://" + html_path],
            check=True, capture_output=True, text=True,
        )
    finally:
        os.remove(html_path)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--club", required=True, help="club_id des Vereins")
    ap.add_argument("--chrome", help="Pfad zu einem Headless-Chromium")
    ap.add_argument("--no-pdf", action="store_true", help="nur das SQL erzeugen")
    args = ap.parse_args()

    chrome = None if args.no_pdf else find_chrome(args.chrome)
    if not args.no_pdf and not chrome:
        print("Kein Headless-Chromium gefunden – --chrome angeben oder --no-pdf", file=sys.stderr)
        return 1

    offices: list[dict] = []
    for docx in sorted(glob.glob(os.path.join(HERE, "*_Factsheet.docx"))):
        # macOS liefert Dateinamen zerlegt (NFD); die Tabelle oben ist NFC.
        base = unicodedata.normalize("NFC", os.path.basename(docx)[: -len("_Factsheet.docx")])
        title = TITLES.get(base)
        if not title:
            print(f"Übersprungen (kein Titel in TITLES): {base}", file=sys.stderr)
            continue
        plain = run(["pandoc", docx, "-t", "plain", "--wrap=none"])
        data = parse_plain(plain)
        holders, seats = parse_holders(data["holders_cell"])
        pdf = docx[: -len(".docx")] + ".pdf"
        if not args.no_pdf and not os.path.exists(pdf):
            build_pdf(docx, pdf, title, chrome)
            print(f"PDF erzeugt: {os.path.basename(pdf)}")
        offices.append({
            "file": os.path.basename(pdf),
            "object": object_name(os.path.basename(pdf)),
            "title": title,
            "hours": data["hours"],
            "points": data["points"],
            "duties": data["duties"],
            "contact": data["contact"],
            "holders": holders,
            "seats": seats,
        })

    out = os.path.join(HERE, "import_kadetten.sql")
    with open(out, "w", encoding="utf-8") as f:
        f.write("-- Erzeugt von build_factsheets.py – nicht von Hand ändern.\n")
        f.write("-- Ämter mit Factsheet für einen Verein (Migration 0070). Idempotent:\n")
        f.write("-- ein zweiter Lauf aktualisiert die Ämter und ersetzt die Belegung,\n")
        f.write("-- die noch keinem Mitglied zugeordnet ist.\n")
        f.write("do $import$\ndeclare\n")
        f.write(f"  v_club uuid := '{args.club}';\n  v_role uuid;\nbegin\n")
        for old, new in RENAMES.items():
            f.write(
                f"  update functionary_roles set title = {sql_text(new)}\n"
                f"   where club_id = v_club and lower(title) = lower({sql_text(old)})\n"
                f"     and not exists (select 1 from functionary_roles r\n"
                f"                      where r.club_id = v_club and lower(r.title) = lower({sql_text(new)}));\n"
            )
        for o in offices:
            duties = json.dumps(o["duties"], ensure_ascii=False)
            f.write(f"\n  -- {o['file']} → {o['object']}\n")
            f.write(
                "  insert into functionary_roles (club_id, title, duties, hours_per_season, points_label,\n"
                "                                 max_holders, contact_name, factsheet_path)\n"
                f"  values (v_club, {sql_text(o['title'])}, {sql_text(duties)}::jsonb, {sql_text(o['hours'])},\n"
                f"          {sql_text(o['points'])}, {o['seats']}, {sql_text(o['contact'])},\n"
                f"          v_club::text || '/' || {sql_text(o['object'])})\n"
                "  on conflict (club_id, lower(title)) do update\n"
                "     set duties = excluded.duties, hours_per_season = excluded.hours_per_season,\n"
                "         points_label = excluded.points_label, max_holders = excluded.max_holders,\n"
                "         contact_name = excluded.contact_name, factsheet_path = excluded.factsheet_path\n"
                "  returning id into v_role;\n"
                "  delete from functionary_holders where role_id = v_role and member_id is null;\n"
            )
            for h in o["holders"]:
                f.write(
                    "  insert into functionary_holders (role_id, display_name, interim)\n"
                    f"  values (v_role, {sql_text(h['display_name'])}, {'true' if h['interim'] else 'false'});\n"
                )
        f.write("end\n$import$;\n")
    print(f"SQL geschrieben: {os.path.basename(out)} ({len(offices)} Ämter)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
