#!/usr/bin/env bash
# ตั้ง secret ทั้ง 3 ตัวแล้ว deploy Worker
# ใช้: ./deploy.sh   (ต้อง npx wrangler login มาก่อนหนึ่งครั้ง)
set -euo pipefail
cd "$(dirname "$0")"

SEC=secrets.local.json
[ -f "$SEC" ] || { echo "❌ ไม่พบ $SEC"; exit 1; }

echo "→ ตรวจสอบการล็อกอิน"
npx --yes wrangler@latest whoami >/dev/null 2>&1 || {
  echo "❌ ยังไม่ได้ล็อกอิน — รัน  npx wrangler login  ก่อน"; exit 1; }

for KEY in DASH_PASSWORD COOKIE_SECRET DASH_CONFIG; do
  echo "→ ตั้ง secret: $KEY"
  python3 -c "import json,sys;sys.stdout.write(json.load(open('$SEC'))['$KEY'])" \
    | npx --yes wrangler@latest secret put "$KEY"
done

echo "→ deploy"
npx --yes wrangler@latest deploy

echo
echo "✅ เสร็จแล้ว"
echo "   รหัสผ่าน: $(python3 -c "import json;print(json.load(open('$SEC'))['DASH_PASSWORD'])")"
