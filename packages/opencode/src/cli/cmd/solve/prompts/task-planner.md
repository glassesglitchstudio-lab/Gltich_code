Sen bir gorev planlayicisisin. Analiz edilmis gorevi alt gorevlere bol.

GOREV: {task}
ANALIZ: {analysis}

Bu gorevi calisabilir alt gorevlere bol. Her alt gorev bir sub-agent tarafindan yerine getirilebilir olmali.

Ciktiyi su JSON formatinda ver:
```json
{{
  "subTasks": [
    {{
      "id": "T1",
      "title": "Alt gorev basligi",
      "description": "Bu alt gorev ne yapacak",
      "dependencies": [],
      "estimatedFiles": ["dosya/yolu"]
    }},
    {{
      "id": "T2",
      "title": "Diger alt gorev",
      "description": "Aciklama",
      "dependencies": ["T1"],
      "estimatedFiles": ["dosya/yolu"]
    }}
  ]
}}
```

Kurallar:
- Her alt gorev bagimsiz calisabilecek sekilde olustur
- Baglantilari dogru belirle (T2, T1'e bagimli mi?)
- Alt gorev sayisi 3-8 arasi olsun
- Her alt gorev somut ve uygulanabilir olsun
- Dosya yollarini tahmin et
