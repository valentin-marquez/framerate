import { CATEGORY_LABELS, type QuoteDetail } from "@framerate/contracts";
import { Document, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { buildOutboundUrl } from "~/shared/utils/outbound";

// Register a font that supports special characters if needed,
// but standard fonts usually work for basic Spanish.
// We'll use Helvetica for now which is standard.

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#FFFFFF",
    padding: 30,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#111827",
  },
  metadata: {
    fontSize: 10,
    color: "#6B7280",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  table: {
    display: "flex",
    width: "auto",
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  tableRow: {
    margin: "auto",
    flexDirection: "row",
  },
  tableColHeader: {
    width: "40%",
    borderStyle: "solid",
    borderColor: "#E5E7EB",
    borderBottomColor: "#000",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    backgroundColor: "#F9FAFB",
  },
  tableCol: {
    width: "40%",
    borderStyle: "solid",
    borderColor: "#E5E7EB",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  tableColHeaderSmall: {
    width: "20%",
    borderStyle: "solid",
    borderColor: "#E5E7EB",
    borderBottomColor: "#000",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    backgroundColor: "#F9FAFB",
  },
  tableColSmall: {
    width: "20%",
    borderStyle: "solid",
    borderColor: "#E5E7EB",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  tableCellHeader: {
    margin: 5,
    fontSize: 10,
    fontWeight: "bold",
    color: "#374151",
  },
  tableCell: {
    margin: 5,
    fontSize: 10,
    color: "#374151",
  },
  productName: {
    fontSize: 10,
    fontWeight: "bold",
  },
  productSpecs: {
    fontSize: 8,
    color: "#6B7280",
  },
  totals: {
    marginTop: 20,
    alignItems: "flex-end",
  },
  totalRow: {
    flexDirection: "row",
    marginBottom: 5,
  },
  totalLabel: {
    fontSize: 10,
    color: "#6B7280",
    marginRight: 10,
  },
  totalValue: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#111827",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 30,
    right: 30,
    fontSize: 8,
    color: "#9CA3AF",
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 10,
  },
});

const clpPdfFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
});

const formatCurrency = (amount: number) => clpPdfFormatter.format(amount);

interface QuotePDFProps {
  quote: QuoteDetail;
}

export const QuotePDF = ({ quote }: QuotePDFProps) => {
  // Lo que cuenta en el total: los seleccionados (las alternativas guardadas no se exportan).
  const itemsToRender = quote.items.filter((item) => item.isSelected);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{quote.name}</Text>
          <View style={styles.metadata}>
            <Text>
              Creado:{" "}
              {
                // react-doctor-disable-next-line rendering-hydration-mismatch-time -- timezone-stabilized output (es-CL, America/Santiago)
                new Date(quote.createdAt).toLocaleDateString("es-CL", { timeZone: "America/Santiago" })
              }
            </Text>
            <Text>
              Actualizado:{" "}
              {
                // react-doctor-disable-next-line rendering-hydration-mismatch-time -- timezone-stabilized output (es-CL, America/Santiago)
                new Date(quote.updatedAt).toLocaleDateString("es-CL", { timeZone: "America/Santiago" })
              }
            </Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableRow}>
            <View style={styles.tableColHeader}>
              <Text style={styles.tableCellHeader}>Producto</Text>
            </View>
            <View style={styles.tableColHeaderSmall}>
              <Text style={styles.tableCellHeader}>Tienda</Text>
            </View>
            <View style={styles.tableColHeaderSmall}>
              <Text style={styles.tableCellHeader}>Cant.</Text>
            </View>
            <View style={styles.tableColHeaderSmall}>
              <Text style={styles.tableCellHeader}>Efectivo</Text>
            </View>
          </View>

          {itemsToRender.map(({ id, product, offer, quantity }) => (
            <View style={styles.tableRow} key={id}>
              <View style={styles.tableCol}>
                <View style={{ margin: 5 }}>
                  <Text style={styles.productName}>{product.name}</Text>
                  <Text style={styles.productSpecs}>{CATEGORY_LABELS[product.category]}</Text>
                </View>
              </View>
              <View style={styles.tableColSmall}>
                {offer ? (
                  <Link
                    src={buildOutboundUrl(offer.url, "quote_pdf")}
                    style={{ ...styles.tableCell, color: "#2563EB", textDecoration: "none" }}
                  >
                    {offer.store.name}
                  </Link>
                ) : (
                  <Text style={styles.tableCell}>No disponible</Text>
                )}
              </View>
              <View style={styles.tableColSmall}>
                <Text style={styles.tableCell}>{quantity}</Text>
              </View>
              <View style={styles.tableColSmall}>
                <Text style={styles.tableCell}>{offer ? formatCurrency(offer.priceCash * quantity) : "-"}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total con tarjeta:</Text>
            <Text style={{ ...styles.totalValue, color: "#6B7280", textDecoration: "line-through", fontSize: 12 }}>
              {formatCurrency(quote.totals.card)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Efectivo:</Text>
            <Text style={styles.totalValue}>{formatCurrency(quote.totals.cash)}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>Generado por Framerate.cl</Text>
        </View>
      </Page>
    </Document>
  );
};
