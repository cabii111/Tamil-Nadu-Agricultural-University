-- ============================================================================
-- EDII-MAFBIF: Supabase Members Schema Extension & Complete 17 Members Migration
-- Target Table: public.members
-- Preserves display order (#01 to #17), all card attributes, search data, and badges.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Schema Extension: Ensure ALL required columns exist
-- ----------------------------------------------------------------------------
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS innovative_idea text;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS technology text;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS grant_status text DEFAULT 'Grant Sanctioned';
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS funding text;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS category text;

-- ----------------------------------------------------------------------------
-- 2. Permissions & Row Level Security (RLS) Assurance
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON TABLE public.members TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.members TO authenticated;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- Clean up placeholder test record if it exists
DELETE FROM public.members WHERE name = 'Test Member' AND company = 'Test Company';

-- ----------------------------------------------------------------------------
-- 3. Idempotent Migration of all 17 Verified Members
-- ----------------------------------------------------------------------------
INSERT INTO public.members (
  id,
  name,
  designation,
  company,
  innovative_idea,
  funding,
  category,
  technology,
  grant_status,
  photo_url,
  display_order
) VALUES
  (
    'a0000000-0000-0000-0000-000000000001',
    'Dr. S. PRABHU',
    'CEO',
    'ROMA Enterprises',
    'Commercialization of Illamathi- a Phytojuvenoid hormone for enhancing silk productivity',
    '2 Lakhs',
    'sericulture',
    'Sericulture & Silk Tech',
    'Grant Sanctioned',
    '/Public/Members/Dr.S.PRABHU.png',
    1
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'Dr. P. RAJESHWARI',
    'CEO',
    'Rainbow Enterprises',
    'Production of Micronutrient Mixture to enhance quality and yield of mulberry leaves',
    '2 Lakhs',
    'sericulture',
    'Mulberry & Crop Nutrition',
    'Grant Sanctioned',
    '/Public/Members/Dr. P. RAJESHWARI.png',
    2
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'Dr. P. MOHANRAJ',
    'CEO',
    'Jiya Biotech',
    'Commercialization of Probiotics formulation as growth enhancers of Mulberry silkworm',
    '2 Lakhs',
    'biotech',
    'Silkworm Probiotics & Biotech',
    'Grant Sanctioned',
    '/Public/Members/Dr. P. MOHANRAJ.png',
    3
  ),
  (
    'a0000000-0000-0000-0000-000000000004',
    'Mr. C. ABIKKUMAR',
    'CEO',
    'Valento Enterprises',
    'Production of decomposable plastic from silkworm cocoon waste',
    '2 Lakhs',
    'waste',
    'Bioplastics & Waste to Wealth',
    'Grant Sanctioned',
    '/Public/Members/Mr. C. ABIKKUMAR.png',
    4
  ),
  (
    'a0000000-0000-0000-0000-000000000005',
    'Mr. P. Jeevanatham',
    'CEO',
    'Poovanthi Organic Products',
    'Formulation of Chemical Free Organic Handwash from Sapindus emarginatus',
    '2 Lakhs',
    'organic',
    'Organic Hygiene & Botanicals',
    'Grant Sanctioned',
    '/Public/Members/Mr. P. Jeevanatham.png',
    5
  ),
  (
    'a0000000-0000-0000-0000-000000000006',
    'Dr. T. Geetha',
    'CEO',
    'Uyiriyal Biotech',
    'Commercial Spray Dried Formulation of Bacteriocin - An Alternative to Antibiotics',
    '2 Lakhs',
    'biotech',
    'Biotech & Therapeutics',
    'Grant Sanctioned',
    '/Public/Members/Dr. T. Geetha.png',
    6
  ),
  (
    'a0000000-0000-0000-0000-000000000007',
    'Dr. R. Nagganatha Suganthan',
    'Director',
    'Utilis Biosciences',
    'OrchiDia- Test Kit for detecting viral infection in Orchids',
    '2 Lakhs',
    'biotech',
    'Plant Diagnostics & Floral Health',
    'Grant Sanctioned',
    '/Public/Members/Dr.R.Nagganatha Suganthan.png',
    7
  ),
  (
    'a0000000-0000-0000-0000-000000000008',
    'Mrs. M. R. G. Sangeetha',
    'CEO',
    'MRGS Agro Traders',
    'Dual Grant: IVP A - Portable Solar Dehydrator (₹2 Lakhs) | IVP B - Commercialization of Portable Solar Dehydrator (₹3 Lakhs)',
    '5 Lakhs (IVP A + B)',
    'solar',
    'Solar Tech & Food Processing',
    'Grant Sanctioned',
    '/Public/Members/Mrs. M. R. G. Sangeetha.png',
    8
  ),
  (
    'a0000000-0000-0000-0000-000000000009',
    'Ms. S. Gayathri',
    'CEO',
    'Herbo Queen Enterprises',
    'Validation and Commercialization of Forest Based Skin and Body Care Products',
    '2 Lakhs',
    'organic',
    'Forest Botanicals & Wellness',
    'Grant Sanctioned',
    '/Public/Members/Ms. S. Gayathri.png',
    9
  ),
  (
    'a0000000-0000-0000-0000-000000000010',
    'Dr. R. Ramamoorthy',
    'CEO',
    'Aara Enterprises',
    'Talc Based Nano Composite Formulation for Silkworm Disease Management',
    '2 Lakhs',
    'sericulture',
    'Nanotech Crop Protection',
    'Grant Sanctioned',
    '/Public/Members/Dr. R. Ramamoorthy.png',
    10
  ),
  (
    'a0000000-0000-0000-0000-000000000011',
    'Mr. M. Subhash Krishnan',
    'CEO',
    'ESSKAY BIOTECH',
    'Wood seasoning technology for Industrial application of Melia dubia',
    '2 Lakhs',
    'waste',
    'Agroforestry & Timber Seasoning',
    'Grant Sanctioned',
    '/Public/Members/Mr. M. Subhash Krishnan.png',
    11
  ),
  (
    'a0000000-0000-0000-0000-000000000012',
    'Mr. V.S. HARI PRANESSH & Mr. D. DHINESH KUMAR',
    'CEO',
    'Foris Enterprises',
    'Validation and Commercialization of Livestock Feed from Neolamarckia cadamba Leaves - VALUE FROM WASTE',
    '2 Lakhs',
    'waste',
    'Value from Waste & Feed',
    'Grant Sanctioned',
    '/Public/Members/Mr.V.S.HARI PRANESSH and Mr.D.DHINESH KUMAR.png',
    12
  ),
  (
    'a0000000-0000-0000-0000-000000000013',
    'Ms. S.A. BRINDHA BHARATHI',
    'CEO',
    'SUNSHINE ENTERPRISES',
    'Nutristicks for plant growth promotors',
    '2 Lakhs',
    'biotech',
    'Agri Inputs & Growth Promoters',
    'Grant Sanctioned',
    '/Public/Members/Ms. S.A. BRINDHA BHARATHI.png',
    13
  ),
  (
    'a0000000-0000-0000-0000-000000000014',
    'Mr. M.S. Srinithi',
    'CEO',
    'Herbly Ritualls',
    'Specialized Face Mask',
    '6 Lakhs',
    'organic',
    'Herbal Formulations & Cosmetics',
    'Grant Sanctioned',
    '/Public/Members/Mr. M.S. Srinithi.png',
    14
  ),
  (
    'a0000000-0000-0000-0000-000000000015',
    'Mr. V. Muruganatham',
    'Vice President',
    'Greenviro Global Pvt Ltd.',
    'Activated Charcoal',
    '10 Lakhs',
    'waste',
    'Activated Carbon & Industrial Biomass',
    'Grant Sanctioned',
    '/Public/Members/Mr. V. Muruganatham.png',
    15
  ),
  (
    'a0000000-0000-0000-0000-000000000016',
    'Ms. M. R. G. Sangeetha',
    'CEO',
    'MRGS Agro Traders',
    'Portable Solar Dehydrator',
    '6 Lakhs',
    'solar',
    'Clean Tech & Solar Dehydration',
    'Grant Sanctioned',
    '/Public/Members/Ms. M. R. G. Sangeetha.png',
    16
  ),
  (
    'a0000000-0000-0000-0000-000000000017',
    'Mr. V. KABINESH & Ms. M. Kowsalya',
    'CEO',
    'M/s O3 Cordial sac',
    'Bio Compact - replacement for Poly-bag',
    '2 Lakhs',
    'waste',
    'Eco Bioplastics & Green Packaging',
    'Grant Sanctioned',
    '/Public/Members/Mr. V. KABINESH & Ms.M.Kowsalya.png',
    17
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  designation = EXCLUDED.designation,
  company = EXCLUDED.company,
  innovative_idea = EXCLUDED.innovative_idea,
  funding = EXCLUDED.funding,
  category = EXCLUDED.category,
  technology = EXCLUDED.technology,
  grant_status = EXCLUDED.grant_status,
  photo_url = EXCLUDED.photo_url,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- ----------------------------------------------------------------------------
-- 4. Verification Query: Confirm 17 records
-- ----------------------------------------------------------------------------
SELECT display_order, name, designation, company, funding, category, technology, photo_url 
FROM public.members 
ORDER BY display_order ASC;
