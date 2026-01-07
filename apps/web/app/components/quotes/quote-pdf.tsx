import { Document, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

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

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
  }).format(amount);
};

interface QuotePDFProps {
  quote: any;
  items?: any[];
}

export const QuotePDF = ({ quote, items }: QuotePDFProps) => {
  const itemsToRender = items || quote.items;

  const totalNormal = itemsToRender.reduce((acc: number, item: any) => {
    if (!item.product) return acc;
    const price = item.selected_listing ? item.selected_listing.price_normal : item.product.prices?.normal || 0;
    return acc + price * item.quantity;
  }, 0);

  const totalCash = itemsToRender.reduce((acc: number, item: any) => {
    if (!item.product) return acc;
    const price = item.selected_listing ? item.selected_listing.price_cash : item.product.prices?.cash || 0;
    return acc + price * item.quantity;
  }, 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{quote.name}</Text>
          <View style={styles.metadata}>
            <Text>Creado: {new Date(quote.created_at).toLocaleDateString("es-CL")}</Text>
            <Text>Actualizado: {new Date(quote.updated_at).toLocaleDateString("es-CL")}</Text>
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
              <Text style={styles.tableCellHeader}>Precio Ef.</Text>
            </View>
          </View>

          {itemsToRender.map((item: any, index: number) => {
            if (!item.product) {
              return (
                <View style={styles.tableRow} key={item.virtualId || item.id || index}>
                  <View style={styles.tableCol}>
                    <View style={{ margin: 5 }}>
                      <Text style={{ ...styles.productName, color: "#9CA3AF" }}>
                        {item.category?.name || "Componente"}
                      </Text>
                      <Text style={styles.productSpecs}>Pendiente</Text>
                    </View>
                  </View>
                  <View style={styles.tableColSmall}>
                    <Text style={styles.tableCell}>-</Text>
                  </View>
                  <View style={styles.tableColSmall}>
                    <Text style={styles.tableCell}>{item.quantity}</Text>
                  </View>
                  <View style={styles.tableColSmall}>
                    <Text style={styles.tableCell}>-</Text>
                  </View>
                </View>
              );
            }

            const priceCash = item.selected_listing ? item.selected_listing.price_cash : item.product.prices?.cash || 0;

            return (
              <View style={styles.tableRow} key={item.virtualId || item.id || index}>
                <View style={styles.tableCol}>
                  <View style={{ margin: 5 }}>
                    <Text style={styles.productName}>{item.product.name}</Text>
                    <Text style={styles.productSpecs}>{item.product.category?.name}</Text>
                  </View>
                </View>
                <View style={styles.tableColSmall}>
                  {item.selected_listing?.url ? (
                    <Link
                      src={item.selected_listing.url}
                      style={{ ...styles.tableCell, color: "#2563EB", textDecoration: "none" }}
                    >
                      {item.selected_listing?.store?.name || "Mejor precio"}
                    </Link>
                  ) : (
                    <Text style={styles.tableCell}>{item.selected_listing?.store?.name || "Mejor precio"}</Text>
                  )}
                </View>
                <View style={styles.tableColSmall}>
                  <Text style={styles.tableCell}>{item.quantity}</Text>
                </View>
                <View style={styles.tableColSmall}>
                  <Text style={styles.tableCell}>{formatCurrency(priceCash)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Normal:</Text>
            <Text style={{ ...styles.totalValue, color: "#6B7280", textDecoration: "line-through", fontSize: 10 }}>
              {formatCurrency(totalNormal)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Efectivo:</Text>
            <Text style={styles.totalValue}>{formatCurrency(totalCash)}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>Generado por Framerate.cl</Text>
        </View>
      </Page>
    </Document>
  );
};
