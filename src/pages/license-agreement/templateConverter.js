// Ported directly from license-agreement-builder's
// lib/template-converter-core.js (isomorphic Node/browser UMD module,
// converted here to a plain ESM export — the logic itself is
// unchanged). Converts the legal template's Word MERGEFIELD codes,
// manual **** placeholders, checkboxes, price tables and signature
// blocks into docxtemplater {tag} syntax.
//
// Every step locates things via unique surrounding label text rather
// than blind find/replace, since several placeholders are
// byte-identical to each other and only distinguishable by context —
// and every step asserts an exact count, so a template that's been
// restructured fails loudly here rather than producing a silently
// wrong document. See the plan/PROJECT-BRIEF for why this stayed
// deferred initially: it's inherently fragile to any hand-edit of the
// source .docx that changes its structure, not just its wording.

function assertCount(log, label, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
  log.push(`${label}: ${actual}`);
}

function findRow(source, labelText, fromIndex) {
  const rowRe = /<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g;
  rowRe.lastIndex = fromIndex || 0;
  let m;
  while ((m = rowRe.exec(source))) {
    if (m[0].includes(labelText)) return { row: m[0], index: m.index };
  }
  throw new Error(`Row containing "${labelText}" not found`);
}

function splitCells(rowXml) {
  return rowXml.match(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g) || [];
}

function collapseCellTo(cellXml, innerXml) {
  const paras = cellXml.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g) || [];
  if (paras.length === 0) throw new Error("No paragraphs found in cell: " + cellXml.slice(0, 200));
  const last = paras[paras.length - 1];
  const pPrMatch = last.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
  const pPr = pPrMatch ? pPrMatch[0] : "";
  const openTag = (last.match(/^<w:p\b[^>]*>/) || ["<w:p>"])[0];
  const newPara = `${openTag}${pPr}${innerXml}</w:p>`;
  let result = cellXml;
  paras.forEach((p, i) => {
    result = result.replace(p, i === 0 ? newPara : "");
  });
  return result;
}

function fillCellByLabelAndOffset(source, labelText, offset, tag, fromIndex) {
  const { row, index } = findRow(source, labelText, fromIndex);
  const cells = splitCells(row);
  const labelCellIdx = cells.findIndex((c) => c.includes(labelText));
  if (labelCellIdx === -1) throw new Error(`Label "${labelText}" not found in its own row's cells`);
  const target = cells[labelCellIdx + offset];
  if (!target) throw new Error(`No cell at offset ${offset} from "${labelText}"`);
  const newCell = collapseCellTo(target, `<w:r><w:t xml:space="preserve">{${tag}}</w:t></w:r>`);
  const newRow = row.replace(target, newCell);
  return source.slice(0, index) + newRow + source.slice(index + row.length);
}

export function convertTemplateXml(inputXml) {
  let xml = inputXml;
  const log = [];

  // Step 1: Word MERGEFIELD field-code sequences -> plain {Field_Name} text
  const fieldSeqRe =
    /<w:r\b[^>]*>(?:(?!<\/w:r>)[\s\S])*?<w:fldChar w:fldCharType="begin"\/>[\s\S]*?<\/w:r>([\s\S]*?)<w:r\b[^>]*>(?:(?!<\/w:r>)[\s\S])*?<w:fldChar w:fldCharType="end"\/>[\s\S]*?<\/w:r>/g;
  let fieldCount = 0;
  xml = xml.replace(fieldSeqRe, (whole, middle) => {
    const nameMatch = whole.match(/MERGEFIELD\s+([^\s<]+)/);
    if (!nameMatch) return whole;
    const fieldName = nameMatch[1];
    const cachedRunMatch = middle.match(
      /<w:r\b([^>]*)>((?:(?!<\/w:r>)[\s\S])*?)<w:t[^>]*>([\s\S]*?)<\/w:t>((?:(?!<\/w:r>)[\s\S])*?)<\/w:r>/
    );
    let rPr = "";
    if (cachedRunMatch) {
      const runInner = cachedRunMatch[2] + cachedRunMatch[4];
      const rPrMatch = runInner.match(/<w:rPr>[\s\S]*?<\/w:rPr>/);
      if (rPrMatch) rPr = rPrMatch[0];
    }
    fieldCount++;
    return `<w:r>${rPr}<w:t xml:space="preserve">{${fieldName}}</w:t></w:r>`;
  });
  assertCount(log, "MERGEFIELD sequences converted", fieldCount, 63);

  const leftoverFld = (xml.match(/<w:fldChar/g) || []).length;
  const leftoverInstr = (xml.match(/<w:instrText/g) || []).length;
  if (leftoverFld || leftoverInstr) {
    throw new Error(`${leftoverFld} fldChar and ${leftoverInstr} instrText nodes left unconverted`);
  }

  // Step 2: checkboxes -> plain tags resolving to a ballot-box glyph at
  // merge time. Two pairs, each x2 (Purchase Agreement + Licence
  // Agreement), told apart by proximity to their label text.
  let checkboxCount = 0;
  let firstOwnerCheckboxCount = 0;
  xml = xml.replace(/<w:sdt>(?:(?!<\/w:sdt>)[\s\S])*?<\/w:sdt>/g, (whole, offset, full) => {
    if (!whole.includes("w14:checkbox")) return whole;

    const nearBefore = full.slice(Math.max(0, offset - 250), offset);
    const en1647At = nearBefore.lastIndexOf("1647");
    const bs3632At = nearBefore.lastIndexOf("3632");
    if (en1647At !== -1 || bs3632At !== -1) {
      const tag = en1647At > bs3632At ? "en1647_box" : "bs3632_box";
      checkboxCount++;
      return `<w:r><w:rPr><w:rFonts w:ascii="Segoe UI Symbol" w:hAnsi="Segoe UI Symbol" w:cs="Segoe UI Symbol"/></w:rPr><w:t>{${tag}}</w:t></w:r>`;
    }

    const farBefore = full.slice(Math.max(0, offset - 3500), offset);
    const firstOwnerAt = farBefore.lastIndexOf("first owner");
    if (firstOwnerAt !== -1) {
      const distance = farBefore.length - firstOwnerAt;
      const tag = distance < 2000 ? "first_owner_yes_box" : "first_owner_no_box";
      firstOwnerCheckboxCount++;
      return `<w:r><w:rPr><w:rFonts w:ascii="Segoe UI Symbol" w:hAnsi="Segoe UI Symbol" w:cs="Segoe UI Symbol"/></w:rPr><w:t>{${tag}}</w:t></w:r>`;
    }

    return whole;
  });
  assertCount(log, "Build-spec checkboxes converted", checkboxCount, 4);
  assertCount(log, "First-owner Yes/No checkboxes converted", firstOwnerCheckboxCount, 4);

  // Normalize signature "Name:*******" placeholders to one run each -
  // Word's grammar-checker unpredictably splits this on save.
  let splitNamePlaceholdersNormalized = 0;
  xml = xml.replace(
    /<w:proofErr w:type="gramStart"\/><w:r\b([^>]*)>((?:(?!<\/w:r>)[\s\S])*?)<w:t[^>]*>Name:(\*+)<\/w:t><\/w:r><w:proofErr w:type="gramEnd"\/><w:r\b[^>]*>((?:(?!<\/w:r>)[\s\S])*?)<w:t[^>]*>(\*+)<\/w:t><\/w:r>/g,
    (whole, rAttrs, before1, stars1, before2, stars2) => {
      const rPrMatch = before1.match(/<w:rPr>[\s\S]*?<\/w:rPr>/);
      const rPr = rPrMatch ? rPrMatch[0] : "";
      splitNamePlaceholdersNormalized++;
      return `<w:r${rAttrs}>${rPr}<w:t>Name:${stars1}${stars2}</w:t></w:r>`;
    }
  );
  log.push(`Split Name:*/****** signature placeholders normalized to one run: ${splitNamePlaceholdersNormalized}`);

  // Step 3: the 6 non-signature **** placeholders, told apart by
  // content (signature ones read exactly "Name:" + asterisks).
  let placeholderIndex = 0;
  let signatureBlockPlaceholderCount = 0;
  xml = xml.replace(/<w:t([^>]*)>([^<]*\*\*\*\*[^<]*)<\/w:t>/g, (whole, rawAttrs, innerText) => {
    if (/^Name:\*+$/.test(innerText)) {
      signatureBlockPlaceholderCount++;
      return whole;
    }
    placeholderIndex++;
    const attrs = rawAttrs.replace(/\s*xml:space="[^"]*"/, "");
    switch (placeholderIndex) {
      case 1:
        return `<w:t${attrs} xml:space="preserve">{special_terms}</w:t>`;
      case 2:
        return `<w:t${attrs} xml:space="preserve">£{pitch_fee_current_year} </w:t>`;
      case 3:
        return `<w:t${attrs} xml:space="preserve">£{pitch_fee_full_year} </w:t>`;
      case 4:
        return `<w:t${attrs} xml:space="preserve">01-07-{rates_payment_year}</w:t>`;
      case 5:
        return `<w:t${attrs} xml:space="preserve">£{rates_current_year}</w:t>`;
      case 6:
        return `<w:t${attrs} xml:space="preserve">£{rates_full_year}</w:t>`;
      default:
        throw new Error(`Unexpected extra **** placeholder #${placeholderIndex}`);
    }
  });
  assertCount(log, "Non-signature **** placeholders converted", placeholderIndex, 6);
  assertCount(log, "Signature-block **** placeholders left for step 6", signatureBlockPlaceholderCount, 4);

  // Delete the filler paragraphs + "COMPLETE OR INSERT..." instruction
  // paragraph that follow {special_terms} - not needed once the wizard
  // fills the tag directly.
  {
    const tagPos = xml.indexOf("{special_terms}");
    if (tagPos === -1) throw new Error("{special_terms} tag not found");
    const afterTagParaEnd = xml.indexOf("</w:p>", tagPos) + "</w:p>".length;
    const completeOrInsertPos = xml.indexOf("COMPLETE OR INSERT", afterTagParaEnd);
    if (completeOrInsertPos === -1) throw new Error('"COMPLETE OR INSERT" text not found');
    const afterCompleteParaEnd = xml.indexOf("</w:p>", completeOrInsertPos) + "</w:p>".length;
    xml = xml.slice(0, afterTagParaEnd) + xml.slice(afterCompleteParaEnd);
    log.push("Special terms filler paragraphs removed");
  }

  // Step 4: Deposit / part-exchange / balance / completion cells
  xml = fillCellByLabelAndOffset(xml, "Deposit paid:", 1, "deposit_amount");
  xml = fillCellByLabelAndOffset(xml, "Deposit paid:", 2, "deposit_date");
  xml = fillCellByLabelAndOffset(xml, "Allowance for part exchange:", 1, "partex_amount");
  xml = fillCellByLabelAndOffset(xml, "Allowance for part exchange:", 2, "partex_date");
  xml = fillCellByLabelAndOffset(xml, "Balance:", 1, "balance_amount");
  xml = fillCellByLabelAndOffset(xml, "Balance:", 2, "balance_date");
  xml = fillCellByLabelAndOffset(xml, "Completion Date:", 1, "completion_date");
  xml = fillCellByLabelAndOffset(xml, "Estimated Completion Date", 1, "estimated_completion_date");
  log.push("Deposit/part-exchange/balance/completion cells filled");

  // Step 5: price tables -> repeating rows.
  {
    const { index } = findRow(xml, "Items Included in the window price");
    const tableEnd = xml.indexOf("</w:tbl>", index) + "</w:tbl>".length;
    const table = xml.slice(index, tableEnd);
    const rowsInTable = table.match(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g) || [];
    if (rowsInTable.length !== 5) {
      throw new Error(`Expected 5 rows in Items Included (header + Caravan + 2 blanks + totals), found ${rowsInTable.length}`);
    }
    const [, caravanRow, blankRow1, blankRow2] = rowsInTable;
    const cells = splitCells(caravanRow);
    if (cells.length !== 2) throw new Error(`Expected 2 cells in the Caravan row, found ${cells.length}`);
    const newDescCell = collapseCellTo(cells[0], `<w:r><w:t xml:space="preserve">{#included_items}{description}</w:t></w:r>`);
    const newAmountCell = collapseCellTo(cells[1], `<w:r><w:t xml:space="preserve">{amount}{/included_items}</w:t></w:r>`);
    const newCaravanRow = caravanRow.replace(cells[0], newDescCell).replace(cells[1], newAmountCell);
    const newTable = table.replace(caravanRow, newCaravanRow).replace(blankRow1, "").replace(blankRow2, "");
    xml = xml.slice(0, index) + newTable + xml.slice(tableEnd);
    log.push("Items Included: Caravan row converted to {#included_items} loop, 2 blank rows removed");
  }
  xml = fillCellByLabelAndOffset(xml, "Agreed purchase price:", 1, "agreed_purchase_price");

  {
    const { index } = findRow(xml, "Additional Costs");
    const tableEnd = xml.indexOf("</w:tbl>", index) + "</w:tbl>".length;
    const table = xml.slice(index, tableEnd);
    const rowsInTable = table.match(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g) || [];
    if (rowsInTable.length !== 3) {
      throw new Error(`Expected 3 rows in the Additional Costs table (header + 2 blank), found ${rowsInTable.length}`);
    }
    const [, firstBlank, secondBlank] = rowsInTable;
    const cells = splitCells(firstBlank);
    if (cells.length !== 2) throw new Error(`Expected 2 cells in the Additional Costs row, found ${cells.length}`);
    const newDescCell = collapseCellTo(cells[0], `<w:r><w:t xml:space="preserve">{#additional_items}{description}</w:t></w:r>`);
    const newAmountCell = collapseCellTo(cells[1], `<w:r><w:t xml:space="preserve">{amount}{/additional_items}</w:t></w:r>`);
    const newFirstBlank = firstBlank.replace(cells[0], newDescCell).replace(cells[1], newAmountCell);
    const newTable = table.replace(firstBlank, newFirstBlank).replace(secondBlank, "");
    xml = xml.slice(0, index) + newTable + xml.slice(tableEnd);
    log.push("Additional Costs: converted to {#additional_items} loop, extra blank row removed");
  }
  xml = fillCellByLabelAndOffset(xml, "Agreed total purchase price including additional costs", 1, "agreed_total_purchase_price");

  // Step 6: signature blocks - both the Purchase Agreement and Licence
  // Agreement sections independently, in document order.
  const signedRe = /<w:t[^>]*>Signed:_+<\/w:t>/;
  const nameBlockRe = /<w:r\b[^>]*>((?:(?!<\/w:r>)[\s\S])*?)<w:t[^>]*>Name:\*+<\/w:t><\/w:r>/;
  function findPrecedingSigned(from, upTo) {
    let at = -1;
    for (let cursor = from; ; ) {
      const m = xml.slice(cursor, upTo).match(signedRe);
      if (!m) break;
      at = cursor + m.index;
      cursor = at + m[0].length;
    }
    return at;
  }

  let searchFrom = 0;
  ["Purchase Agreement", "Licence Agreement"].forEach((sectionName) => {
    const firstNameRel = xml.slice(searchFrom).match(nameBlockRe);
    if (!firstNameRel) throw new Error(`${sectionName}: Name:*** run not found`);
    const firstNameAt = searchFrom + firstNameRel.index;
    const firstSignedAt = findPrecedingSigned(searchFrom, firstNameAt);
    if (firstSignedAt === -1) throw new Error(`${sectionName}: first block's Signed:_ run not found`);
    const firstParaStart = xml.lastIndexOf("<w:p ", firstSignedAt);
    if (firstParaStart === -1) throw new Error(`${sectionName}: start of the first Signed paragraph not found`);
    const openTag = `<w:p><w:r><w:t>{#signees}</w:t></w:r></w:p>`;
    xml = xml.slice(0, firstParaStart) + openTag + xml.slice(firstParaStart);

    const shiftedNameAt = firstNameAt + openTag.length;
    const rPrMatch = firstNameRel[1].match(/<w:rPr>[\s\S]*?<\/w:rPr>/);
    const rPr = rPrMatch ? rPrMatch[0] : "";
    const nameReplacement = `<w:r>${rPr}<w:t xml:space="preserve">Name: {.}</w:t></w:r>`;
    xml = xml.slice(0, shiftedNameAt) + nameReplacement + xml.slice(shiftedNameAt + firstNameRel[0].length);

    const firstNameParaEnd = xml.indexOf("</w:p>", shiftedNameAt) + "</w:p>".length;
    const closeTag = `<w:p><w:r><w:t>{/signees}</w:t></w:r></w:p>`;
    xml = xml.slice(0, firstNameParaEnd) + closeTag + xml.slice(firstNameParaEnd);
    log.push(`${sectionName} signature block: first Signed/Name pair wrapped in {#signees} loop (own paragraphs)`);

    const afterFirstPair = firstNameParaEnd + closeTag.length;
    const secondNameRel = xml.slice(afterFirstPair).match(nameBlockRe);
    if (!secondNameRel) throw new Error(`${sectionName}: second Name:*** block not found`);
    const secondNameAt = afterFirstPair + secondNameRel.index;
    const secondSignedAt = findPrecedingSigned(afterFirstPair, secondNameAt);
    if (secondSignedAt === -1) throw new Error(`${sectionName}: second block's Signed:_ run not found`);
    const secondBlockEnd = secondNameAt + secondNameRel[0].length;
    const secondParaStart = xml.lastIndexOf("<w:p ", secondSignedAt);
    const secondParaEnd = xml.indexOf("</w:p>", secondBlockEnd) + "</w:p>".length;
    xml = xml.slice(0, secondParaStart) + xml.slice(secondParaEnd);
    log.push(`${sectionName} signature block: second (redundant) Signed/Name pair removed`);

    searchFrom = secondParaStart;
  });

  const remainingStars = (xml.match(/\*{4,}/g) || []).length;
  if (remainingStars) {
    throw new Error(`${remainingStars} groups of **** still remain unconverted`);
  }

  return { xml, log };
}

// Converts a whole .docx (as an ArrayBuffer/Uint8Array) using the given
// PizZip constructor. `validateXml`, if supplied, is called with the
// converted XML and must return an array of error strings.
export function convertTemplateDocx(docxData, PizZipCtor, validateXml) {
  const zip = new PizZipCtor(docxData);
  const originalXml = zip.file("word/document.xml").asText();
  const { xml, log } = convertTemplateXml(originalXml);

  if (validateXml) {
    const errors = validateXml(xml);
    if (errors && errors.length) {
      throw new Error("Converted document.xml is not well-formed:\n" + errors.join("\n"));
    }
    log.push("document.xml is well-formed XML");
  }

  zip.file("word/document.xml", xml);
  return { zip, log };
}
