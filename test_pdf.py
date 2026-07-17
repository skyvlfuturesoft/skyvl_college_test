import pdfplumber
import os

pdf_dir = r"c:\Users\Sasikumar baskar\Downloads\skyvl_mocktest1\backend\uploads"
pdf_files = [f for f in os.listdir(pdf_dir) if f.endswith(".pdf")]

for pdf_file in pdf_files:
    target_pdf = os.path.join(pdf_dir, pdf_file)
    print(f"\n====================================")
    print(f"Inspecting PDF: {target_pdf}")
    print(f"====================================")
    
    with pdfplumber.open(target_pdf) as pdf:
        for idx, page in enumerate(pdf.pages):
            print(f"--- Page {idx+1} ---")
            text = page.extract_text()
            print(f"  Text length: {len(text) if text else 0}")
            print(f"  Images count: {len(page.images)}")
            if page.images:
                for img_idx, img in enumerate(page.images):
                    print(f"    Image {img_idx+1}: keys={list(img.keys())}")
                    if 'stream' in img:
                        stream = img['stream']
                        if hasattr(stream, 'attrs'):
                            print(f"      Filter={stream.attrs.get('Filter')}")
                            print(f"      ColorSpace={stream.attrs.get('ColorSpace')}")
