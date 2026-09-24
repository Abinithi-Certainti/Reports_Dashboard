package com.certainti.reports.query;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Figures are the Tender Report summary from the Power BI PDF export (extracts/tender-report/06_layout.md),
 * so this test proves the legacy mode reproduces what users see today, and the corrected mode adds to 100%.
 */
class CalculationsTest {

    private static final Object[][] PDF_ROWS = {
            {"Cash", "1047867.83", "13.84"},
            {"US Cash", "6540.40", "0.10"},
            {"Debit Card", "2217602.79", "33.99"},
            {"Visa", "1518103.51", "23.27"},
            {"Mastercard", "825238.52", "12.65"},
            {"AMEX", "142338.32", "2.18"},
            {"Starbucks Card", "217801.30", "3.34"},
            {"DO Debit", "478225.28", "7.33"},
            {"DO Visa", "409033.55", "6.27"},
    };

    /** The PDF only shows part of the list; this row stands in for the scrolled-off rows so totals match. */
    private static final String HIDDEN_ROWS_AMOUNT = "709307.60";

    private static List<Map<String, Object>> rows() {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Object[] r : PDF_ROWS) {
            rows.add(row((String) r[0], (String) r[1]));
        }
        rows.add(row("Other (not visible in PDF)", HIDDEN_ROWS_AMOUNT));
        return rows;
    }

    private static Map<String, Object> row(String paymentType, String amount) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("payment_type", paymentType);
        m.put("tender_amount", new BigDecimal(amount));
        return m;
    }

    private static String pct(Object share) {
        return ((BigDecimal) share).movePointRight(2).setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    @Test
    void grandTotalMatchesThePdf() {
        BigDecimal total = rows().stream().map(r -> (BigDecimal) r.get("tender_amount"))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        assertThat(total).isEqualByComparingTo("7572059.10");
    }

    @Test
    void legacyModeReproducesEveryPercentageInThePdf() {
        List<Map<String, Object>> rows = rows();
        Calculations.apply(Calculations.TENDER_LEGACY_SHARE, "pct", "tender_amount", rows);
        for (int i = 0; i < PDF_ROWS.length; i++) {
            assertThat(pct(rows.get(i).get("pct")))
                    .as("%s", PDF_ROWS[i][0])
                    .isEqualTo(PDF_ROWS[i][2]);
        }
    }

    @Test
    void correctedModeAddsUpTo100Percent() {
        List<Map<String, Object>> rows = rows();
        Calculations.apply(Calculations.SHARE_OF_TOTAL, "pct", "tender_amount", rows);
        BigDecimal sum = rows.stream().map(r -> (BigDecimal) r.get("pct")).reduce(BigDecimal.ZERO, BigDecimal::add);
        assertThat(sum.setScale(6, RoundingMode.HALF_UP)).isEqualByComparingTo("1.000000");
        assertThat(pct(rows.get(2).get("pct"))).as("Debit Card corrected").isEqualTo("29.29");
    }

    @Test
    void totalRowIs100PercentInBothModes() {
        for (String mode : List.of(Calculations.TENDER_LEGACY_SHARE, Calculations.SHARE_OF_TOTAL)) {
            Map<String, Object> total = new LinkedHashMap<>(Map.of("tender_amount", new BigDecimal("7572059.10")));
            List<Map<String, Object>> rows = new ArrayList<>(List.of(total));
            Calculations.apply(mode, "pct", "tender_amount", rows);
            assertThat(pct(total.get("pct"))).as(mode).isEqualTo("100.00");
        }
    }
}
