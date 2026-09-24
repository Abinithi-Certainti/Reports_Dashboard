package com.certainti.reports.query;

import java.math.BigDecimal;
import java.math.MathContext;
import java.util.List;
import java.util.Map;

/**
 * Values worked out from the returned rows, after the query.
 *
 * <ul>
 *   <li>{@code share_of_total}: row value / sum of all rows. Adds to 100%.</li>
 *   <li>{@code tender_legacy_share}: reproduces the Tender Report's Power BI "% to Total". The Cash row divides by the
 *   grand total; every other row divides by the total of the non-cash rows, because [Total Payment] loses the cash
 *   part on non-cash rows. Does not add to 100%. Kept only so the old and new numbers can be compared side by side.
 *   Reproduces the default view (no payment-type filter); see extracts/tender-report/06_layout.md.</li>
 * </ul>
 */
public final class Calculations {

    public static final String SHARE_OF_TOTAL = "share_of_total";
    public static final String TENDER_LEGACY_SHARE = "tender_legacy_share";

    private static final MathContext MC = MathContext.DECIMAL64;
    private static final String CASH = "Cash";

    private Calculations() {
    }

    /** Adds column {@code outputId} to every row. */
    public static void apply(String type, String outputId, String ofMeasure, List<Map<String, Object>> rows) {
        switch (type) {
            case SHARE_OF_TOTAL -> shareOfTotal(outputId, ofMeasure, rows);
            case TENDER_LEGACY_SHARE -> tenderLegacyShare(outputId, ofMeasure, rows);
            default -> throw new SqlBuilder.BadRequest("Unknown calculation type: " + type);
        }
    }

    private static void shareOfTotal(String outputId, String of, List<Map<String, Object>> rows) {
        BigDecimal total = sum(rows, of, null);
        rows.forEach(r -> r.put(outputId, divide(value(r, of), total)));
    }

    private static void tenderLegacyShare(String outputId, String of, List<Map<String, Object>> rows) {
        boolean byPaymentType = !rows.isEmpty() && rows.get(0).containsKey("payment_type");
        BigDecimal grandTotal = sum(rows, of, null);
        if (!byPaymentType) {
            // A total row: the old report shows 100% here.
            rows.forEach(r -> r.put(outputId, divide(value(r, of), grandTotal)));
            return;
        }
        BigDecimal nonCashTotal = sum(rows, of, false);
        rows.forEach(r -> {
            boolean cash = CASH.equals(r.get("payment_type"));
            r.put(outputId, divide(value(r, of), cash ? grandTotal : nonCashTotal));
        });
    }

    /** Sums a column. {@code cash} null = all rows, true = Cash rows only, false = non-cash rows only. */
    private static BigDecimal sum(List<Map<String, Object>> rows, String column, Boolean cash) {
        BigDecimal total = BigDecimal.ZERO;
        for (Map<String, Object> r : rows) {
            if (cash != null && cash != CASH.equals(r.get("payment_type"))) {
                continue;
            }
            total = total.add(value(r, column));
        }
        return total;
    }

    private static BigDecimal value(Map<String, Object> row, String column) {
        Object v = row.get(column);
        if (v == null) {
            return BigDecimal.ZERO;
        }
        return v instanceof BigDecimal b ? b : new BigDecimal(v.toString());
    }

    private static BigDecimal divide(BigDecimal value, BigDecimal total) {
        return total.signum() == 0 ? null : value.divide(total, MC);
    }
}
