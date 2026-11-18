# SEO ของเว็บไซต์ SEEN — สถานะและสิ่งที่ต้องทำต่อ

เว็บไซต์หลัก: https://seen1236.github.io/
ชื่อแบรนด์: SEEN | ณัฐนันท์ ตรีทศ (Natthanan Treetos / seen1236)

## สิ่งที่แก้ไขในโปรเจกต์แล้ว

- canonical, og:url, twitter:image และ JSON-LD ชี้ไปที่ https://seen1236.github.io/ ทั้งหมด (โดเมนเดียว ไม่ขัดแย้งกัน)
- Person / ProfilePage / WebSite / ItemList ใน JSON-LD พร้อม alternateName (SEEN, ซีน, seen1236, SEEN1236, Natthanan Treetos, Natthanan Trethos)
- ภาพโปรไฟล์จริง 1:1 (profile-seen.webp) ใช้ทั้งในหน้าเว็บ, Person.image และ primaryImageOfPage
- og-image.jpg 1200×630 พร้อม og:image:width / og:image:height / og:image:type
- favicon.ico, favicon.svg, icon-192.png, icon-512.png, apple-touch-icon.png เป็นโลโก้ SEEN (เดิมเป็นโลโก้ GitHub)
- site.webmanifest + manifest.json (name = SEEN, ภาษาไทย)
- robots.txt, sitemap.xml (รวมรูปภาพ), 404.html (noindex)
- เนื้อหาโปรไฟล์/About แสดงจริงบนหน้าเว็บแล้ว (เดิมถูกซ่อนด้วย CSS ซึ่งเข้าข่าย hidden text)
- แก้ width/height ของภาพโปรไฟล์ให้ตรงไฟล์จริง (360×480) ลด layout shift

## ต้องทำด้วยตัวเอง (Search Console)

1. เปิด https://search.google.com/search-console ด้วยบัญชีของเจ้าของเว็บ
2. เพิ่มทรัพย์สินแบบ "คำนำหน้า URL" = https://seen1236.github.io/
3. ยืนยันสิทธิ์: ไฟล์ googledc78262d51942a87.html มีอยู่ในโปรเจกต์แล้ว (วิธี HTML file) — ถ้า Google ให้โค้ดใหม่ ให้วางไฟล์ชื่อนั้นไว้ที่ root แล้ว deploy
4. ส่ง Sitemap: https://seen1236.github.io/sitemap.xml
5. URL Inspection → https://seen1236.github.io/ → Test live URL → Request indexing
6. ตรวจ Page indexing / Mobile usability / Core Web Vitals หลัง 1–2 สัปดาห์

## ชื่อเว็บไซต์ในผลค้นหา

Google เลือกชื่อเว็บไซต์เองจาก WebSite.name, og:site_name, title และชื่อโดเมน
โดเมน github.io เป็นซับโดเมนที่แชร์กับผู้ใช้ GitHub ทั้งหมด Google จึงมักแสดง "GitHub"
ถ้าต้องการให้ขึ้น "SEEN" อย่างแน่นอน ต้องใช้โดเมนของตัวเอง (เช่น seen1236.com) แล้วตั้ง canonical มาที่โดเมนนั้น

## ภาพโปรไฟล์ในผลค้นหา

Google แสดงภาพบุคคลเมื่อมั่นใจว่าภาพนั้นเป็นบุคคลเดียวกันจากหลายแหล่ง
- ภาพจริงในเว็บตอนนี้ต้นฉบับมีขนาด 360×480 px ซึ่งเล็ก
- ควรเปลี่ยนเป็นภาพใบหน้าชัดเจน สี่เหลี่ยมจัตุรัส อย่างน้อย 1000×1000 px (หรือใหญ่กว่า) แล้วแทนที่ไฟล์ profile-seen.webp และ 1778995068748.webp
- ใส่ภาพเดียวกันใน GitHub, YouTube, TikTok, Instagram, Facebook เพื่อให้ Google ยืนยันตัวตนได้ง่ายขึ้น
- Google ไม่รับประกันว่าจะแสดงภาพในทุกผลค้นหา

## ลิงก์ยืนยันตัวตน (สำคัญต่ออันดับชื่อบุคคล)

ใส่ลิงก์ https://seen1236.github.io/ ไว้ในไบโอ/โปรไฟล์ของ GitHub, YouTube, TikTok, Instagram, Facebook และอีเมล signature

## หมายเหตุ

- การแก้ไฟล์ในเครื่องยังไม่เท่ากับเผยแพร่: ต้อง commit/push ขึ้น GitHub Pages ก่อน Google จึงจะเห็น
- ไม่มีการรับประกันอันดับหรือผลการค้นหา
- ไม่ใช้ข้อความซ่อน คีย์เวิร์ดซ้ำ หรือหน้าเนื้อหาซ้ำ
- ถ้ายังมีเว็บสำเนาที่ https://s.jirayu.net/ ควรตั้ง redirect 301 มาที่ https://seen1236.github.io/ เพื่อรวมสัญญาณ canonical
