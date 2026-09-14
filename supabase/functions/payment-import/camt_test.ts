/**
 * Das Lesen der Bankdatei (UC-047) – `deno test` in diesem Ordner.
 *
 * Die Beispiele sind auf das Nötige gekürzt, tragen aber die Formen, an denen
 * das Lesen scheitern kann: camt.053 mit Sammelbuchung, camt.054 mit einzelner
 * Gutschrift, ein Namensraum-Präfix, eine Belastung und eine Referenz ohne
 * `QRR`-Kennzeichnung.
 */
import { assertEquals } from 'jsr:@std/assert@1';
import { extractPayments, referenceOf } from './camt.ts';

const CAMT053 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.04">
  <BkToCstmrStmt>
    <Stmt>
      <Ntry>
        <Amt Ccy="CHF">150.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt><Dt>2026-10-02</Dt></BookgDt>
        <ValDt><Dt>2026-10-01</Dt></ValDt>
        <NtryDtls>
          <TxDtls>
            <Amt Ccy="CHF">100.00</Amt>
            <RltdPties><Dbtr><Nm>Anna Muster</Nm></Dbtr></RltdPties>
            <RmtInf><Strd><CdtrRefInf>
              <Tp><CdOrPrtry><Prtry>QRR</Prtry></CdOrPrtry></Tp>
              <Ref>21 00000 00003 13947 14300 09017</Ref>
            </CdtrRefInf></Strd></RmtInf>
          </TxDtls>
          <TxDtls>
            <Amt Ccy="CHF">50.00</Amt>
            <RltdPties><Dbtr><Pty><Nm>Beat Beispiel</Nm></Pty></Dbtr></RltdPties>
            <RmtInf><Strd><CdtrRefInf>
              <Tp><CdOrPrtry><Prtry>QRR</Prtry></CdOrPrtry></Tp>
              <Ref>961116900000006600000000942</Ref>
            </CdtrRefInf></Strd></RmtInf>
          </TxDtls>
        </NtryDtls>
      </Ntry>
      <Ntry>
        <Amt Ccy="CHF">80.00</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <BookgDt><Dt>2026-10-03</Dt></BookgDt>
        <NtryDtls><TxDtls>
          <RmtInf><Strd><CdtrRefInf>
            <Tp><CdOrPrtry><Prtry>QRR</Prtry></CdOrPrtry></Tp>
            <Ref>210000000003139471430009017</Ref>
          </CdtrRefInf></Strd></RmtInf>
        </TxDtls></NtryDtls>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;

const CAMT054_PREFIXED = `<?xml version="1.0" encoding="UTF-8"?>
<ns:Document xmlns:ns="urn:iso:std:iso:20022:tech:xsd:camt.054.001.04">
  <ns:BkToCstmrDbtCdtNtfctn>
    <ns:Ntfctn>
      <ns:Ntry>
        <ns:Amt Ccy="CHF">42.50</ns:Amt>
        <ns:CdtDbtInd>CRDT</ns:CdtDbtInd>
        <ns:ValDt><ns:Dt>2026-11-04</ns:Dt></ns:ValDt>
        <ns:RmtInf><ns:Strd><ns:CdtrRefInf>
          <ns:Ref>123000000000000000000000025</ns:Ref>
        </ns:CdtrRefInf></ns:Strd></ns:RmtInf>
      </ns:Ntry>
    </ns:Ntfctn>
  </ns:BkToCstmrDbtCdtNtfctn>
</ns:Document>`;

Deno.test('liest beide Zahlungen einer Sammelbuchung', () => {
  const payments = extractPayments(CAMT053);

  assertEquals(payments.length, 2);
  assertEquals(payments[0], {
    reference: '210000000003139471430009017',
    amount: 100,
    currency: 'CHF',
    paid_at: '2026-10-02',
    payer: 'Anna Muster',
  });
  assertEquals(payments[1].reference, '961116900000006600000000942');
  assertEquals(payments[1].amount, 50);
  // Die zweite Form des Namens (`Dbtr/Pty/Nm`) kommt bei camt.053 v4 vor.
  assertEquals(payments[1].payer, 'Beat Beispiel');
});

Deno.test('lässt Belastungen liegen', () => {
  // Die Belastung trägt dieselbe Referenz wie die erste Gutschrift. Würde sie
  // mitgelesen, meldete die Datei eine Zahlung, die niemand geleistet hat.
  const references = extractPayments(CAMT053).map((payment) => payment.reference);
  assertEquals(references.filter((ref) => ref === '210000000003139471430009017').length, 1);
});

Deno.test('liest camt.054 mit Namensraum-Präfix und ohne QRR-Kennzeichnung', () => {
  const payments = extractPayments(CAMT054_PREFIXED);

  assertEquals(payments.length, 1);
  assertEquals(payments[0].reference, '123000000000000000000000025');
  assertEquals(payments[0].amount, 42.5);
  assertEquals(payments[0].paid_at, '2026-11-04');
  assertEquals(payments[0].payer, null);
});

Deno.test('nimmt keine Referenz, die keine QR-Referenz ist', () => {
  const node = {
    RmtInf: { Strd: { CdtrRefInf: { Ref: 'RF18 5390 0754 7034' } } },
  };
  assertEquals(referenceOf(node), null);
});

Deno.test('eine leere Datei ergibt keine Zahlungen', () => {
  assertEquals(extractPayments('<Document></Document>'), []);
});
