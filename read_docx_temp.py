import zipfile
import xml.etree.ElementTree as ET
import sys

def get_docx_text(path):
    word_schema = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
    ns = '{' + word_schema + '}'
    with zipfile.ZipFile(path) as docx:
        tree = ET.XML(docx.read('word/document.xml'))
    paragraphs = []
    for paragraph in tree.iter(ns + 'p'):
        texts = [node.text for node in paragraph.iter(ns + 't') if node.text]
        if texts:
            paragraphs.append(''.join(texts))
    return '\n'.join(paragraphs)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        print(get_docx_text(sys.argv[1]))
