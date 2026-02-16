export function getDeptCategoryColor(dept) {
    dept = (dept || "").trim();
    if (dept.match(/Pharmacist Extern|นักศึกษา/i)) return '#0056b3'; // High-Contrast Blue
    if (dept.match(/Pharmacy|คลังยา|เภสัช/i)) return '#0f7d45';     // High-Contrast Green
    if (dept.match(/General|ทั่วไป/i)) return '#495057';           // High-Contrast Gray
    if (dept.match(/IT|ไอที/i)) return '#5a2d9c';                  // High-Contrast Purple
    if (dept.match(/Admin|ธุรการ/i)) return '#c21b2e';               // High-Contrast Red
    if (dept.match(/Sales|การตลาด/i)) return '#e65100';            // High-Contrast Orange
    if (dept.match(/HR|บุคคล/i)) return '#b82167';                 // High-Contrast Pink
    return '#1a1d20';                                             // High-Contrast Dark
}
