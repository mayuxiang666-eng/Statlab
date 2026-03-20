import json
from deep_translator import GoogleTranslator
import time

def main():
    with open('extracted_chinese.json', 'r', encoding='utf-8') as f:
        chinese_strings = json.load(f)
    print(f"Total phrases: {len(chinese_strings)}")

    en_dict = {}
    de_dict = {}

    translator_en = GoogleTranslator(source='auto', target='en')
    translator_de = GoogleTranslator(source='auto', target='de')

    chunk_size = 50
    chunks = [chinese_strings[i:i + chunk_size] for i in range(0, len(chinese_strings), chunk_size)]

    count = 0
    for chunk in chunks:
        try:
            time.sleep(1) # avoid rate limit
            en_translations = translator_en.translate_batch(chunk)
            de_translations = translator_de.translate_batch(chunk)

            for i, src in enumerate(chunk):
                en_dict[src] = en_translations[i] or src
                de_dict[src] = de_translations[i] or src
            
            count += len(chunk)
            print(f"Translated {count} / {len(chinese_strings)}")
        except Exception as e:
            print("Error in batch translation:", e)
            for src in chunk:
                # fallbacks
                try:
                    time.sleep(0.5)
                    en_dict[src] = translator_en.translate(src)
                    de_dict[src] = translator_de.translate(src)
                except:
                    en_dict[src] = src
                    de_dict[src] = src
            count += len(chunk)

    with open('client/src/dict.json', 'w', encoding='utf-8') as out_f:
        json.dump({
            "en": en_dict,
            "de": de_dict
        }, out_f, ensure_ascii=False, indent=2)
    print("All translation saved to client/src/dict.json")

if __name__ == "__main__":
    main()
