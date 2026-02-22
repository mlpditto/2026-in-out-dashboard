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

export function getDeptPastelColor(dept) {
    dept = (dept || "").trim();
    if (dept.match(/Pharmacist Extern|นักศึกษา/i)) return '#e3f2fd'; // Pastel Blue
    if (dept.match(/Pharmacy|คลังยา|เภสัช/i)) return '#e8f5e9';     // Pastel Green
    if (dept.match(/General|ทั่วไป/i)) return '#f8f9fa';           // Pastel Gray
    if (dept.match(/IT|ไอที/i)) return '#f3e5f5';                  // Pastel Purple
    if (dept.match(/Admin|ธุรการ/i)) return '#ffebee';               // Pastel Red
    if (dept.match(/Sales|การตลาด/i)) return '#fff3e0';            // Pastel Orange
    if (dept.match(/HR|บุคคล/i)) return '#fce4ec';                 // Pastel Pink
    return '#f8f9fa';                                             // Default Light
}
