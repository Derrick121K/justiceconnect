# South African place dataset

The application schema supports province-aware populated-place imports. To load the GeoNames South Africa dump:

1. Download the current `ZA.zip` from https://download.geonames.org/export/dump/ and extract `ZA.txt` into this folder.
2. Apply migrations through `0009_national_place_import_support.sql`.
3. Add `SUPABASE_SERVICE_ROLE_KEY` to a private local `.env.local` file only.
4. Run `npm run import:places`.

The importer upserts GeoNames populated places and their coordinates. It does not claim to contain every suburb, township, street or municipal ward. For full service-area precision, augment this source with authoritative municipal boundary and address datasets. Review province-code mapping against the source's Admin1 codes before the first production import.
