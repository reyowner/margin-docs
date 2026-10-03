const MARK_STYLES = {
  bold: { bold: true },
  italic: { italics: true },
  underline: { decoration: 'underline' },
  strike: { decoration: 'lineThrough' },
  code: { font: 'Roboto', background: '#f1f3f7', color: '#384152' },
  link: { color: '#3558bf', decoration: 'underline' },
};

function inlineRuns(nodes = []) {
  const runs = [];
  for (const node of nodes) {
    if (node.type === 'hardBreak') {
      runs.push({ text: '\n' });
      continue;
    }
    if (node.type !== 'text' || !node.text) continue;
    const run = { text: node.text };
    for (const mark of node.marks || []) Object.assign(run, MARK_STYLES[mark.type] || {});
    const link = node.marks?.find((mark) => mark.type === 'link');
    if (link?.attrs?.href) run.link = link.attrs.href;
    runs.push(run);
  }
  return runs.length ? runs : [{ text: ' ' }];
}

function nodeBlocks(node) {
  if (!node) return [];
  if (node.type === 'doc') return (node.content || []).flatMap(nodeBlocks);
  if (node.type === 'paragraph') return [{ text: inlineRuns(node.content), style: 'paragraph' }];
  if (node.type === 'heading') return [{ text: inlineRuns(node.content), style: `heading${Math.min(Math.max(node.attrs?.level || 1, 1), 3)}` }];
  if (node.type === 'bulletList' || node.type === 'orderedList') {
    const items = (node.content || []).map((item) => {
      const content = [];
      for (const child of item.content || []) {
        if (child.type === 'paragraph') content.push({ text: inlineRuns(child.content), margin: [0, 0, 0, 2] });
        else content.push(...nodeBlocks(child));
      }
      return content.length === 1 ? content[0] : { stack: content };
    });
    return [{ [node.type === 'orderedList' ? 'ol' : 'ul']: items, margin: [0, 3, 0, 8] }];
  }
  if (node.type === 'blockquote') return [{ stack: (node.content || []).flatMap(nodeBlocks), style: 'blockquote' }];
  if (node.type === 'codeBlock') return [{ text: inlineRuns(node.content), style: 'codeBlock' }];
  if (node.type === 'horizontalRule') return [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 495, y2: 0, lineWidth: 0.6, lineColor: '#d9deea' }], margin: [0, 5, 0, 12] }];
  return (node.content || []).flatMap(nodeBlocks);
}

export function buildDocumentPdfDefinition(title, editorJson, exportedAt = new Date()) {
  const safeTitle = String(title || 'Untitled document').trim() || 'Untitled document';
  return {
    info: { title: safeTitle, subject: 'Document exported from Margin', creator: 'Margin' },
    pageSize: 'LETTER',
    pageMargins: [58, 56, 58, 58],
    defaultStyle: { font: 'Roboto', fontSize: 10.5, color: '#263147', lineHeight: 1.45 },
    footer: (page, pageCount) => ({
      columns: [
        { text: 'MARGIN  /  DOCUMENT', color: '#8b94a5', fontSize: 8, characterSpacing: 1.1 },
        { text: `${page} / ${pageCount}`, alignment: 'right', color: '#8b94a5', fontSize: 8 },
      ],
      margin: [58, 0, 58, 24],
    }),
    content: [
      { text: safeTitle, style: 'documentTitle' },
      { text: `Exported ${exportedAt.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`, style: 'exportMeta' },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 496, y2: 0, lineWidth: 0.8, lineColor: '#dce2ed' }], margin: [0, 0, 0, 19] },
      ...nodeBlocks(editorJson),
    ],
    styles: {
      documentTitle: { fontSize: 26, bold: true, color: '#17243b', margin: [0, 0, 0, 5], lineHeight: 1.12 },
      exportMeta: { fontSize: 8.5, color: '#7c879a', margin: [0, 0, 0, 18] },
      paragraph: { margin: [0, 0, 0, 10] },
      heading1: { fontSize: 20, bold: true, color: '#1b2941', margin: [0, 17, 0, 8], lineHeight: 1.15 },
      heading2: { fontSize: 15, bold: true, color: '#243451', margin: [0, 14, 0, 6], lineHeight: 1.2 },
      heading3: { fontSize: 12, bold: true, color: '#34445f', margin: [0, 11, 0, 5] },
      blockquote: { margin: [12, 3, 0, 11], color: '#586782', italics: true },
      codeBlock: { fontSize: 9, color: '#384152', fillColor: '#f1f3f7', margin: [0, 3, 0, 10] },
    },
  };
}

let pdfRuntime;

async function loadPdfRuntime() {
  if (!pdfRuntime) {
    pdfRuntime = Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')]).then(([pdfModule, fontModule]) => {
      const pdfMake = pdfModule.default;
      pdfMake.addVirtualFileSystem(fontModule.default);
      return pdfMake;
    }).catch((error) => { pdfRuntime = null; throw error; });
  }
  return pdfRuntime;
}

export async function downloadDocumentPdf(title, editorJson) {
  const pdfMake = await loadPdfRuntime();
  const fileName = `${String(title || 'document').replace(/[\\/:*?"<>|]/g, '-').trim().slice(0, 80) || 'document'}.pdf`;
  await pdfMake.createPdf(buildDocumentPdfDefinition(title, editorJson)).download(fileName);
  return fileName;
}
