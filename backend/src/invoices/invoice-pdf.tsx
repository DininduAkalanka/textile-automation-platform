import type * as React from 'react';
// TYPE-ONLY import: erased at compile time so this file never eagerly
// require()s @react-pdf/renderer, which is a pure-ESM package (no CJS build).
// The real primitives are handed in at runtime via a dynamic import() from
// invoice.service.ts — the only way CommonJS (our build target) can load an
// ESM-only dependency under Node 20.
import type * as ReactPDF from '@react-pdf/renderer';

/**
 * The order invoice as a React-PDF document. Pure presentation — it takes
 * already-formatted strings (money is formatted upstream so this file never
 * does float math). Bold red-and-black identity: a dark header slab, a red
 * spine down the left edge, a black table head and a clean totals block.
 */

export interface InvoiceItem {
  name: string;
  description?: string;
  quantity: number;
  unitPrice: string; // "Rs 1,800.00"
  amount: string; // "Rs 3,600.00"
}

export interface InvoiceData {
  business: {
    name: string;
    address: string;
    landline: string;
    whatsapp: string;
    regNo: string; // business registration / tax no. — shown only when set
    bank: string; // bank-transfer details — shown only when set
  };
  orderNumber: string;
  date: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shipTo: string[];
  paymentMethod: string;
  paymentStatus: string;
  items: InvoiceItem[];
  subtotal: string;
  shipping: string;
  tax: string;
  total: string;
}

const CRIMSON = '#CC0000';
const INK = '#141414';
const PAPER = '#F1F0EE'; // zebra row / grand-total tint
const MUTED = '#6B6B6B';
const LINE = '#E4E1DA';
const WHITE = '#FFFFFF';
const FADE = '#B9B9B9'; // muted text on the dark header

const SPINE = 30; // width of the red left column
const PAD_L = 52; // left content padding (clears the spine)
const PAD_R = 42;

function makeStyles(StyleSheet: typeof ReactPDF.StyleSheet) {
  return StyleSheet.create({
    page: { position: 'relative', fontFamily: 'Helvetica', fontSize: 9.5, color: INK },

    // ── red spine down the whole left edge (solid crimson + even weave ribs) ──
    spine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: SPINE, backgroundColor: CRIMSON },
    // Thin, evenly-spaced horizontal ribs to evoke woven cloth — deliberate,
    // not the random blocks from before.
    rib: { position: 'absolute', left: 0, width: SPINE, height: 3, backgroundColor: 'rgba(0,0,0,0.12)' },
    // Crisp black hairline where the spine meets the page.
    spineEdge: { position: 'absolute', top: 0, bottom: 0, left: SPINE, width: 0.8, backgroundColor: INK },

    // ── dark header slab ────────────────────────────────────────────────────
    header: { backgroundColor: INK, paddingTop: 40, paddingBottom: 32, paddingLeft: PAD_L, paddingRight: PAD_R },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },

    brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    logoTile: { width: 22, height: 22, borderRadius: 3, backgroundColor: CRIMSON, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
    logoText: { color: WHITE, fontFamily: 'Helvetica-Bold', fontSize: 10, letterSpacing: 0.5 },
    brandName: { color: WHITE, fontFamily: 'Helvetica-Bold', fontSize: 13, letterSpacing: 0.4 },

    title: { color: WHITE, fontFamily: 'Helvetica-Bold', fontSize: 44, letterSpacing: 2 },
    titleNo: { color: CRIMSON, fontFamily: 'Helvetica-Bold', fontSize: 9, letterSpacing: 1, marginTop: 6 },
    titleDate: { color: FADE, fontSize: 8.5, marginTop: 3, letterSpacing: 0.4 },

    billBox: { maxWidth: 200, alignItems: 'flex-end' },
    billLabel: { color: CRIMSON, fontFamily: 'Helvetica-Bold', fontSize: 7.5, letterSpacing: 1.4, marginBottom: 5 },
    billName: { color: WHITE, fontFamily: 'Helvetica-Bold', fontSize: 10, textAlign: 'right', marginBottom: 2 },
    billLine: { color: FADE, fontSize: 8.5, textAlign: 'right', lineHeight: 1.5 },

    // ── body ────────────────────────────────────────────────────────────────
    // paddingBottom leaves room for the fixed footer pinned to the page bottom.
    body: { paddingLeft: PAD_L, paddingRight: PAD_R, paddingTop: 26, paddingBottom: 72 },

    tHead: { flexDirection: 'row', backgroundColor: INK, paddingVertical: 7, paddingHorizontal: 10 },
    tHeadCell: { color: WHITE, fontSize: 7.5, letterSpacing: 0.8, fontFamily: 'Helvetica-Bold' },
    row: { flexDirection: 'row', paddingVertical: 9, paddingHorizontal: 10, alignItems: 'flex-start' },
    rowAlt: { backgroundColor: PAPER },
    itemName: { fontFamily: 'Helvetica-Bold', color: INK, marginBottom: 1.5 },
    itemDesc: { color: MUTED, fontSize: 8, lineHeight: 1.4 },

    cNo: { width: 26 },
    cItem: { flex: 1, paddingRight: 8 },
    cQty: { width: 44, textAlign: 'center' },
    cPrice: { width: 74, textAlign: 'right' },
    cTotal: { width: 74, textAlign: 'right' },
    cellMuted: { color: '#3B3B3B' },

    // ── totals + payment ────────────────────────────────────────────────────
    split: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 26 },
    payWrap: { maxWidth: 250 },
    blockLabel: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, letterSpacing: 0.8, color: INK, marginBottom: 6 },
    payLine: { color: MUTED, lineHeight: 1.6, fontSize: 9 },
    payStrong: { color: INK, fontFamily: 'Helvetica-Bold' },

    totals: { width: 230 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3.5 },
    totalLabel: { color: MUTED },
    grandDivider: { borderTopWidth: 1, borderColor: INK, marginTop: 5, marginBottom: 0 },
    grand: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: CRIMSON, paddingVertical: 10, paddingHorizontal: 12, marginTop: 8 },
    grandLabel: { fontFamily: 'Helvetica-Bold', fontSize: 10.5, color: WHITE, letterSpacing: 0.5 },
    grandValue: { fontFamily: 'Helvetica-Bold', fontSize: 13, color: WHITE },

    // ── terms + signature ───────────────────────────────────────────────────
    hr: { borderTopWidth: 1, borderColor: LINE, marginTop: 26 },
    lower: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 22 },
    terms: { maxWidth: 300 },
    termsText: { color: MUTED, fontSize: 8, lineHeight: 1.5, marginTop: 4 },
    sign: { alignItems: 'center' },
    signName: { fontFamily: 'Helvetica-Oblique', fontSize: 20, color: INK, marginBottom: 3 },
    signRule: { width: 130, borderTopWidth: 1, borderColor: INK, paddingTop: 4 },
    signLabel: { fontSize: 8, color: MUTED, textAlign: 'center' },

    // Fixed page footer, pinned to the bottom edge on every page.
    footer: { position: 'absolute', left: PAD_L, right: PAD_R, bottom: 28, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', borderTopWidth: 1, borderColor: LINE, paddingTop: 12 },
    footerLeft: { flexDirection: 'row', alignItems: 'baseline' },
    thanks: { fontFamily: 'Helvetica-Bold', color: INK, fontSize: 10, letterSpacing: 0.4 },
    thanksMeta: { color: MUTED, fontSize: 8, marginLeft: 8 },
    footerRight: { color: MUTED, fontSize: 8 },
  });
}

/**
 * Build the invoice document element. `pdf` is the @react-pdf/renderer module,
 * passed in from the dynamic import() in invoice.service.ts so this file has no
 * runtime dependency on the ESM package (see the type-only import above).
 */
export function buildInvoiceDocument(
  pdf: typeof ReactPDF,
  data: InvoiceData,
): React.ReactElement<ReactPDF.DocumentProps> {
  const { Document, Page, StyleSheet, Text, View } = pdf;
  const s = makeStyles(StyleSheet);
  const b = data.business;

  return (
    <Document
      title={`Invoice ${data.orderNumber}`}
      author={b.name}
      subject={`Invoice for order ${data.orderNumber}`}
    >
      <Page size="A4" style={s.page}>
        {/* ── Dark header slab ── */}
        <View style={s.header}>
          <View style={s.headerRow}>
            {/* Left: brand + big title */}
            <View>
              <View style={s.brandRow}>
                <View style={s.logoTile}>
                  <Text style={s.logoText}>NT</Text>
                </View>
                <Text style={s.brandName}>{b.name}</Text>
              </View>
              <Text style={s.title}>INVOICE</Text>
              <Text style={s.titleNo}>INVOICE NO : #{data.orderNumber}</Text>
              <Text style={s.titleDate}>DATE : {data.date}</Text>
            </View>

            {/* Right: bill-to */}
            <View style={s.billBox}>
              <Text style={s.billLabel}>INVOICE TO</Text>
              <Text style={s.billName}>{data.customerName}</Text>
              {data.shipTo.map((line, i) => (
                <Text key={i} style={s.billLine}>{line}</Text>
              ))}
              {data.customerEmail ? (
                <Text style={s.billLine}>{data.customerEmail}</Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* ── Body ── */}
        <View style={s.body}>
          {/* Items table */}
          <View style={s.tHead}>
            <Text style={[s.tHeadCell, s.cNo]}>NO</Text>
            <Text style={[s.tHeadCell, s.cItem]}>ITEM DESCRIPTION</Text>
            <Text style={[s.tHeadCell, s.cQty]}>QTY</Text>
            <Text style={[s.tHeadCell, s.cPrice]}>PRICE</Text>
            <Text style={[s.tHeadCell, s.cTotal]}>TOTAL</Text>
          </View>
          {data.items.map((item, i) => (
            <View key={i} style={i % 2 === 1 ? [s.row, s.rowAlt] : s.row}>
              <Text style={[s.cNo, s.cellMuted]}>{i + 1}.</Text>
              <View style={s.cItem}>
                <Text style={s.itemName}>{item.name}</Text>
                {item.description ? (
                  <Text style={s.itemDesc}>{item.description}</Text>
                ) : null}
              </View>
              <Text style={[s.cQty, s.cellMuted]}>{item.quantity}</Text>
              <Text style={[s.cPrice, s.cellMuted]}>{item.unitPrice}</Text>
              <Text style={[s.cTotal, s.payStrong]}>{item.amount}</Text>
            </View>
          ))}

          {/* Payment info + totals */}
          <View style={s.split}>
            <View style={s.payWrap}>
              <Text style={s.blockLabel}>PAYMENT INFO</Text>
              <Text style={s.payLine}>
                Method: <Text style={s.payStrong}>{data.paymentMethod}</Text>
              </Text>
              <Text style={s.payLine}>
                Status: <Text style={s.payStrong}>{data.paymentStatus}</Text>
              </Text>
              <Text style={s.payLine}>WhatsApp: {b.whatsapp}</Text>
              <Text style={s.payLine}>Landline: {b.landline}</Text>
              {b.bank ? (
                <Text style={s.payLine}>
                  Bank: <Text style={s.payStrong}>{b.bank}</Text>
                </Text>
              ) : null}
            </View>

            <View style={s.totals}>
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Sub total</Text>
                <Text>{data.subtotal}</Text>
              </View>
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Shipping</Text>
                <Text>{data.shipping}</Text>
              </View>
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Tax</Text>
                <Text>{data.tax}</Text>
              </View>
              <View style={s.grandDivider} />
              <View style={s.grand}>
                <Text style={s.grandLabel}>GRAND TOTAL</Text>
                <Text style={s.grandValue}>{data.total}</Text>
              </View>
            </View>
          </View>

          <View style={s.hr} />

          {/* Terms + signature */}
          <View style={s.lower}>
            <View style={s.terms}>
              <Text style={s.blockLabel}>TERMS &amp; CONDITIONS</Text>
              <Text style={s.termsText}>
                Goods once sold are exchangeable within 7 days with this invoice
                and original tags intact. Made-to-order and cut-fabric items are
                non-refundable. Thank you for supporting {b.name}.
              </Text>
            </View>
            <View style={s.sign}>
              <Text style={s.signName}>{b.name.split(' ')[0]}</Text>
              <View style={s.signRule}>
                <Text style={s.signLabel}>Authorised signature</Text>
              </View>
            </View>
          </View>

        </View>

        {/* Fixed page footer, pinned to the bottom edge */}
        <View style={s.footer} fixed>
          <View style={s.footerLeft}>
            <Text style={s.thanks}>THANK YOU FOR YOUR ORDER!</Text>
            <Text style={s.thanksMeta}>
              {b.address}  ·  {b.name}
            </Text>
          </View>
          <Text
            style={s.footerRight}
            render={({ pageNumber, totalPages }) =>
              `${b.regNo ? b.regNo + '  ·  ' : ''}Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>

        {/* Red spine drawn last so it sits on top — solid crimson, even weave
            ribs and a crisp black edge, running the full page height. */}
        <View style={s.spine} fixed />
        {Array.from({ length: 60 }, (_, i) => (
          <View key={i} style={[s.rib, { top: 6 + i * 14 }]} fixed />
        ))}
        <View style={s.spineEdge} fixed />
      </Page>
    </Document>
  );
}
