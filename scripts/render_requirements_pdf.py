from pathlib import Path
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Preformatted

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'docs' / 'requirements.md'
OUT = ROOT / 'docs' / 'requirements.pdf'

text = SRC.read_text(encoding='utf-8')
lines = text.splitlines()

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='TitleCenter', parent=styles['Title'], alignment=TA_CENTER, spaceAfter=18))
styles.add(ParagraphStyle(name='BodyTight', parent=styles['BodyText'], leading=14, spaceAfter=6))
styles.add(ParagraphStyle(name='MonoBlock', parent=styles['Code'], fontName='Courier', fontSize=8, leading=10, spaceAfter=6))

story = []
for line in lines:
    if not line.strip():
        story.append(Spacer(1, 0.10 * inch))
        continue
    if line.startswith('# '):
        story.append(Paragraph(line[2:].strip(), styles['TitleCenter']))
    elif line.startswith('## '):
        story.append(Spacer(1, 0.08 * inch))
        story.append(Paragraph(f'<b>{line[3:].strip()}</b>', styles['Heading2']))
    elif line.startswith('### '):
        story.append(Paragraph(f'<b>{line[4:].strip()}</b>', styles['Heading3']))
    elif line.startswith('- '):
        story.append(Paragraph('&bull; ' + line[2:].strip(), styles['BodyTight']))
    elif line.startswith('|'):
        story.append(Preformatted(line, styles['MonoBlock']))
    else:
        safe = line.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        story.append(Paragraph(safe, styles['BodyTight']))

doc = SimpleDocTemplate(str(OUT), pagesize=letter, leftMargin=0.7*inch, rightMargin=0.7*inch, topMargin=0.7*inch, bottomMargin=0.7*inch)
doc.build(story)
print(str(OUT))
