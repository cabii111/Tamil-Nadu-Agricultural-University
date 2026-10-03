/**
 * EDII-MAFBIF Content Manager — Members & Mentors CRUD Modules (Phase 2 / S4)
 * Pure Vanilla JavaScript implementation connecting to Supabase tables:
 * - public.members (id, name, designation, company, photo_url)
 * - public.mentors (id, name, designation, institution, specialization)
 * 
 * Reuses window.supabaseClient initialized in /js/supabase-client.js.
 */

(function () {
  'use strict';

  // Module state
  let client = null;
  let membersList = [];
  let mentorsList = [];
  let currentDeleteTarget = null; // { type: 'member'|'mentor', id, name }
  let pendingMemberPhotoFile = null;
  let pendingMentorPhotoFile = null;

  // Utility: Format bytes to human readable string
  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Utility: HTML Escape for safe rendering
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Toast Notification System
  function showToast(type, title, message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `pointer-events-auto transform transition-all duration-300 ease-out translate-y-2 opacity-0 p-4 rounded-2xl shadow-soft-lg border flex items-start gap-3 bg-white text-xs ${
      type === 'success'
        ? 'border-emerald-200 text-slate-800'
        : type === 'error'
        ? 'border-rose-200 text-slate-800'
        : 'border-slate-200 text-slate-800'
    }`;

    const iconHtml =
      type === 'success'
        ? `<div class="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
           </div>`
        : type === 'error'
        ? `<div class="w-6 h-6 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
           </div>`
        : `<div class="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
           </div>`;

    toast.innerHTML = `
      ${iconHtml}
      <div class="flex-1 min-w-0">
        <p class="font-bold ${type === 'success' ? 'text-emerald-900' : type === 'error' ? 'text-rose-900' : 'text-slate-900'}">${escapeHtml(title)}</p>
        <p class="text-slate-600 mt-0.5 break-words">${escapeHtml(message)}</p>
      </div>
      <button type="button" class="text-slate-400 hover:text-slate-600 p-1 rounded-md transition" onclick="this.parentElement.remove()">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    `;

    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
      toast.classList.add('translate-y-0', 'opacity-100');
    });

    // Auto dismiss after 4.5s
    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
      }
    }, 4500);
  }

  // Parse Supabase error message with friendly advice
  function parseSupabaseError(err) {
    if (!err) return 'An unknown error occurred.';
    let msg = err.message || 'Operation failed.';
    if (err.code === '42501' || msg.toLowerCase().includes('permission denied')) {
      return `Database Permission Denied (42501): Current user lacks table privileges. Verify Supabase RLS policies and table grants for the authenticated role.`;
    }
    if (msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('rls')) {
      return `Row-Level Security Violation: No permissive RLS policy found for this operation in Supabase.`;
    }
    return msg;
  }

  // View Switcher (overview | members | mentors)
  function switchView(viewName) {
    const viewOverview = document.getElementById('viewOverview');
    const viewMembers = document.getElementById('viewMembers');
    const viewMentors = document.getElementById('viewMentors');

    if (!viewOverview || !viewMembers || !viewMentors) return;

    if (viewName === 'members') {
      viewOverview.classList.add('hidden');
      viewMentors.classList.add('hidden');
      viewMembers.classList.remove('hidden');
      window.location.hash = '#members';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      loadMembers();
    } else if (viewName === 'mentors') {
      viewOverview.classList.add('hidden');
      viewMembers.classList.add('hidden');
      viewMentors.classList.remove('hidden');
      window.location.hash = '#mentors';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      loadMentors();
    } else {
      viewMembers.classList.add('hidden');
      viewMentors.classList.add('hidden');
      viewOverview.classList.remove('hidden');
      if (window.location.hash) {
        history.replaceState(null, null, ' ');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // =========================================================================
  // VERIFIED INCUBATEE MEMBERS DATASET (17 Members)
  // =========================================================================
  const VERIFIED_EXISTING_MEMBERS = [
    {
      id: 'a0000000-0000-0000-0000-000000000001',
      name: 'Dr. S. PRABHU',
      designation: 'CEO',
      company: 'ROMA Enterprises',
      innovative_idea: 'Commercialization of Illamathi- a Phytojuvenoid hormone for enhancing silk productivity',
      funding: '2 Lakhs',
      category: 'sericulture',
      technology: 'Sericulture & Silk Tech',
      grant_status: 'Grant Sanctioned',
      photo_url: '/Public/Members/Dr.S.PRABHU.png',
      display_order: 1
    },
    {
      id: 'a0000000-0000-0000-0000-000000000002',
      name: 'Dr. P. RAJESHWARI',
      designation: 'CEO',
      company: 'Rainbow Enterprises',
      innovative_idea: 'Production of Micronutrient Mixture to enhance quality and yield of mulberry leaves',
      funding: '2 Lakhs',
      category: 'sericulture',
      technology: 'Mulberry & Crop Nutrition',
      grant_status: 'Grant Sanctioned',
      photo_url: '/Public/Members/Dr. P. RAJESHWARI.png',
      display_order: 2
    },
    {
      id: 'a0000000-0000-0000-0000-000000000003',
      name: 'Dr. P. MOHANRAJ',
      designation: 'CEO',
      company: 'Jiya Biotech',
      innovative_idea: 'Commercialization of Probiotics formulation as growth enhancers of Mulberry silkworm',
      funding: '2 Lakhs',
      category: 'biotech',
      technology: 'Silkworm Probiotics & Biotech',
      grant_status: 'Grant Sanctioned',
      photo_url: '/Public/Members/Dr. P. MOHANRAJ.png',
      display_order: 3
    },
    {
      id: 'a0000000-0000-0000-0000-000000000004',
      name: 'Mr. C. ABIKKUMAR',
      designation: 'CEO',
      company: 'Valento Enterprises',
      innovative_idea: 'Production of decomposable plastic from silkworm cocoon waste',
      funding: '2 Lakhs',
      category: 'waste',
      technology: 'Bioplastics & Waste to Wealth',
      grant_status: 'Grant Sanctioned',
      photo_url: '/Public/Members/Mr. C. ABIKKUMAR.png',
      display_order: 4
    },
    {
      id: 'a0000000-0000-0000-0000-000000000005',
      name: 'Mr. P. Jeevanatham',
      designation: 'CEO',
      company: 'Poovanthi Organic Products',
      innovative_idea: 'Formulation of Chemical Free Organic Handwash from Sapindus emarginatus',
      funding: '2 Lakhs',
      category: 'organic',
      technology: 'Organic Hygiene & Botanicals',
      grant_status: 'Grant Sanctioned',
      photo_url: '/Public/Members/Mr. P. Jeevanatham.png',
      display_order: 5
    },
    {
      id: 'a0000000-0000-0000-0000-000000000006',
      name: 'Dr. T. Geetha',
      designation: 'CEO',
      company: 'Uyiriyal Biotech',
      innovative_idea: 'Commercial Spray Dried Formulation of Bacteriocin - An Alternative to Antibiotics',
      funding: '2 Lakhs',
      category: 'biotech',
      technology: 'Biotech & Therapeutics',
      grant_status: 'Grant Sanctioned',
      photo_url: '/Public/Members/Dr. T. Geetha.png',
      display_order: 6
    },
    {
      id: 'a0000000-0000-0000-0000-000000000007',
      name: 'Dr. R. Nagganatha Suganthan',
      designation: 'Director',
      company: 'Utilis Biosciences',
      innovative_idea: 'OrchiDia- Test Kit for detecting viral infection in Orchids',
      funding: '2 Lakhs',
      category: 'biotech',
      technology: 'Plant Diagnostics & Floral Health',
      grant_status: 'Grant Sanctioned',
      photo_url: '/Public/Members/Dr.R.Nagganatha Suganthan.png',
      display_order: 7
    },
    {
      id: 'a0000000-0000-0000-0000-000000000008',
      name: 'Mrs. M. R. G. Sangeetha',
      designation: 'CEO',
      company: 'MRGS Agro Traders',
      innovative_idea: 'Dual Grant: IVP A - Portable Solar Dehydrator (₹2 Lakhs) | IVP B - Commercialization of Portable Solar Dehydrator (₹3 Lakhs)',
      funding: '5 Lakhs (IVP A + B)',
      category: 'solar',
      technology: 'Solar Tech & Food Processing',
      grant_status: 'Grant Sanctioned',
      photo_url: '/Public/Members/Mrs. M. R. G. Sangeetha.png',
      display_order: 8
    },
    {
      id: 'a0000000-0000-0000-0000-000000000009',
      name: 'Ms. S. Gayathri',
      designation: 'CEO',
      company: 'Herbo Queen Enterprises',
      innovative_idea: 'Validation and Commercialization of Forest Based Skin and Body Care Products',
      funding: '2 Lakhs',
      category: 'organic',
      technology: 'Forest Botanicals & Wellness',
      grant_status: 'Grant Sanctioned',
      photo_url: '/Public/Members/Ms. S. Gayathri.png',
      display_order: 9
    },
    {
      id: 'a0000000-0000-0000-0000-000000000010',
      name: 'Dr. R. Ramamoorthy',
      designation: 'CEO',
      company: 'Aara Enterprises',
      innovative_idea: 'Talc Based Nano Composite Formulation for Silkworm Disease Management',
      funding: '2 Lakhs',
      category: 'sericulture',
      technology: 'Nanotech Crop Protection',
      grant_status: 'Grant Sanctioned',
      photo_url: '/Public/Members/Dr. R. Ramamoorthy.png',
      display_order: 10
    },
    {
      id: 'a0000000-0000-0000-0000-000000000011',
      name: 'Mr. M. Subhash Krishnan',
      designation: 'CEO',
      company: 'ESSKAY BIOTECH',
      innovative_idea: 'Wood seasoning technology for Industrial application of Melia dubia',
      funding: '2 Lakhs',
      category: 'waste',
      technology: 'Agroforestry & Timber Seasoning',
      grant_status: 'Grant Sanctioned',
      photo_url: '/Public/Members/Mr. M. Subhash Krishnan.png',
      display_order: 11
    },
    {
      id: 'a0000000-0000-0000-0000-000000000012',
      name: 'Mr. V.S. HARI PRANESSH & Mr. D. DHINESH KUMAR',
      designation: 'CEO',
      company: 'Foris Enterprises',
      innovative_idea: 'Validation and Commercialization of Livestock Feed from Neolamarckia cadamba Leaves - VALUE FROM WASTE',
      funding: '2 Lakhs',
      category: 'waste',
      technology: 'Value from Waste & Feed',
      grant_status: 'Grant Sanctioned',
      photo_url: '/Public/Members/Mr.V.S.HARI PRANESSH and Mr.D.DHINESH KUMAR.png',
      display_order: 12
    },
    {
      id: 'a0000000-0000-0000-0000-000000000013',
      name: 'Ms. S.A. BRINDHA BHARATHI',
      designation: 'CEO',
      company: 'SUNSHINE ENTERPRISES',
      innovative_idea: 'Nutristicks for plant growth promotors',
      funding: '2 Lakhs',
      category: 'biotech',
      technology: 'Agri Inputs & Growth Promoters',
      grant_status: 'Grant Sanctioned',
      photo_url: '/Public/Members/Ms. S.A. BRINDHA BHARATHI.png',
      display_order: 13
    },
    {
      id: 'a0000000-0000-0000-0000-000000000014',
      name: 'Mr. M.S. Srinithi',
      designation: 'CEO',
      company: 'Herbly Ritualls',
      innovative_idea: 'Specialized Face Mask',
      funding: '6 Lakhs',
      category: 'organic',
      technology: 'Herbal Formulations & Cosmetics',
      grant_status: 'Grant Sanctioned',
      photo_url: '/Public/Members/Mr. M.S. Srinithi.png',
      display_order: 14
    },
    {
      id: 'a0000000-0000-0000-0000-000000000015',
      name: 'Mr. V. Muruganatham',
      designation: 'Vice President',
      company: 'Greenviro Global Pvt Ltd.',
      innovative_idea: 'Activated Charcoal',
      funding: '10 Lakhs',
      category: 'waste',
      technology: 'Activated Carbon & Industrial Biomass',
      grant_status: 'Grant Sanctioned',
      photo_url: '/Public/Members/Mr. V. Muruganatham.png',
      display_order: 15
    },
    {
      id: 'a0000000-0000-0000-0000-000000000016',
      name: 'Ms. M. R. G. Sangeetha',
      designation: 'CEO',
      company: 'MRGS Agro Traders',
      innovative_idea: 'Portable Solar Dehydrator',
      funding: '6 Lakhs',
      category: 'solar',
      technology: 'Clean Tech & Solar Dehydration',
      grant_status: 'Grant Sanctioned',
      photo_url: '/Public/Members/Ms. M. R. G. Sangeetha.png',
      display_order: 16
    },
    {
      id: 'a0000000-0000-0000-0000-000000000017',
      name: 'Mr. V. KABINESH & Ms. M. Kowsalya',
      designation: 'CEO',
      company: 'M/s O3 Cordial sac',
      innovative_idea: 'Bio Compact - replacement for Poly-bag',
      funding: '2 Lakhs',
      category: 'waste',
      technology: 'Eco Bioplastics & Green Packaging',
      grant_status: 'Grant Sanctioned',
      photo_url: '/Public/Members/Mr. V. KABINESH & Ms.M.Kowsalya.png',
      display_order: 17
    }
  ];

  // =========================================================================
  // MEMBERS MODULE (public.members)
  // =========================================================================

  async function loadMembers() {
    const container = document.getElementById('membersContainer');
    const alertBox = document.getElementById('membersAlert');
    const countBadge = document.getElementById('membersCountBadge');
    if (!container) return;

    if (alertBox) alertBox.classList.add('hidden');

    // Loading State
    container.innerHTML = `
      <div class="py-16 px-6 text-center flex flex-col items-center justify-center">
        <svg class="animate-spin h-8 w-8 text-emerald-600 mb-3" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p class="text-xs font-bold text-slate-700">Connecting to Supabase...</p>
        <p class="text-[11px] text-slate-400 mt-1">Fetching records from public.members</p>
      </div>
    `;

    try {
      const { data, error } = await client
        .from('members')
        .select('*');

      if (error) {
        throw error;
      }

      membersList = Array.isArray(data) ? data : [];
      // Sort primarily by display_order ascending, then name
      membersList.sort((a, b) => {
        const orderA = a.display_order !== null && a.display_order !== undefined ? Number(a.display_order) : 999;
        const orderB = b.display_order !== null && b.display_order !== undefined ? Number(b.display_order) : 999;
        if (orderA !== orderB) return orderA - orderB;
        return (a.name || '').localeCompare(b.name || '');
      });

      if (countBadge) {
        countBadge.textContent = membersList.length;
      }

      renderMembers(membersList);

    } catch (err) {
      console.error('[Members] Fetch error:', err);
      const errorMsg = parseSupabaseError(err);

      if (alertBox) {
        alertBox.className = 'mb-6 p-4 rounded-2xl border border-rose-200 bg-rose-50/80 text-rose-900 text-xs flex items-start gap-3';
        alertBox.innerHTML = `
          <svg class="w-5 h-5 text-rose-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <div class="flex-1">
            <p class="font-bold">Failed to load members from Supabase</p>
            <p class="mt-0.5 leading-relaxed">${escapeHtml(errorMsg)}</p>
          </div>
        `;
        alertBox.classList.remove('hidden');
      }

      container.innerHTML = `
        <div class="py-12 px-6 text-center">
          <div class="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 mx-auto flex items-center justify-center mb-3 border border-rose-100">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          </div>
          <h4 class="text-sm font-bold text-slate-800">Database Connection Error</h4>
          <p class="text-xs text-slate-500 mt-1 max-w-md mx-auto">${escapeHtml(errorMsg)}</p>
          <button type="button" onclick="window.adminModules.loadMembers()" class="mt-4 px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition">
            Try Again
          </button>
        </div>
      `;
    }
  }

  function renderMembers(list) {
    const container = document.getElementById('membersContainer');
    if (!container) return;

    if (!list || list.length === 0) {
      container.innerHTML = `
        <div class="py-16 px-6 text-center">
          <div class="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 mx-auto flex items-center justify-center mb-3.5 shadow-xs">
            <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
          </div>
          <h4 class="text-sm sm:text-base font-bold text-[#0A2E1C]">No Members in Database Yet</h4>
          <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
            The <code class="text-emerald-700 font-mono">public.members</code> table currently has no records. You can synchronize the 17 verified incubatee members or add a member manually.
          </p>
          <div class="mt-5 flex items-center justify-center gap-3">
            <button type="button" onclick="window.adminModules.migrateExistingMembers()" class="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded-xl transition">
              <svg class="w-4 h-4 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              <span>Sync 17 Members Now</span>
            </button>
            <button type="button" onclick="window.adminModules.openAddMemberModal()" class="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-sm transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
              <span>Add Member Manually</span>
            </button>
          </div>
        </div>
      `;
      return;
    }

    // Responsive Table
    let rowsHtml = list
      .map((member, idx) => {
        const hasPhoto = member.photo_url && member.photo_url.trim().length > 0;
        const photoHtml = hasPhoto
          ? `<img src="${escapeHtml(member.photo_url)}" alt="${escapeHtml(member.name)}" class="w-9 h-9 rounded-full object-cover border border-slate-200" onerror="this.onerror=null;this.parentElement.innerHTML='<div class=\\'w-9 h-9 rounded-full bg-emerald-50 text-emerald-800 font-bold text-xs flex items-center justify-center border border-emerald-200\\'>${escapeHtml((member.name || 'M').charAt(0).toUpperCase())}</div>'"/>`
          : `<div class="w-9 h-9 rounded-full bg-emerald-50 text-emerald-800 font-bold text-xs flex items-center justify-center border border-emerald-200/80">
              ${escapeHtml((member.name || 'M').charAt(0).toUpperCase())}
             </div>`;

        const displayNum = member.display_order !== null && member.display_order !== undefined
          ? String(member.display_order).padStart(2, '0')
          : String(idx + 1).padStart(2, '0');

        return `
          <tr class="hover:bg-slate-50/70 transition-colors border-b border-slate-100 last:border-b-0 text-xs">
            <td class="px-4 py-3.5 whitespace-nowrap">
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-[#F0FDF4] text-[#15803D] border border-[#DCFCE7]">
                #${escapeHtml(displayNum)}
              </span>
            </td>
            <td class="px-4 py-3.5">
              <div class="flex items-center gap-3">
                <div class="shrink-0">${photoHtml}</div>
                <div class="min-w-0">
                  <p class="font-bold text-[#0A2E1C] truncate max-w-[200px]" title="${escapeHtml(member.name || '')}">${escapeHtml(member.name || 'Untitled')}</p>
                  <p class="text-[11px] text-slate-400 font-mono mt-0.5 truncate max-w-[160px]">${escapeHtml(member.id)}</p>
                </div>
              </div>
            </td>
            <td class="px-4 py-3.5">
              <p class="text-slate-700 font-medium">${escapeHtml(member.designation || '—')}</p>
              <p class="text-[11px] text-emerald-700 font-semibold truncate max-w-[180px]">${escapeHtml(member.company || '—')}</p>
            </td>
            <td class="px-4 py-3.5">
              <div class="space-y-0.5">
                <span class="inline-block text-[11px] font-semibold text-slate-700 truncate max-w-[180px] block" title="${escapeHtml(member.technology || '')}">
                  ${escapeHtml(member.technology || '—')}
                </span>
                ${
                  member.innovative_idea
                    ? `<p class="text-[11px] text-slate-400 italic truncate max-w-[200px]" title="${escapeHtml(member.innovative_idea)}">“${escapeHtml(member.innovative_idea)}”</p>`
                    : ''
                }
              </div>
            </td>
            <td class="px-4 py-3.5 whitespace-nowrap">
              <div class="space-y-1">
                ${
                  member.funding
                    ? `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200/80">₹ ${escapeHtml(member.funding)}</span>`
                    : `<span class="text-slate-400 text-[11px]">—</span>`
                }
                <div class="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>${escapeHtml(member.grant_status || 'Grant Sanctioned')}</span>
                </div>
              </div>
            </td>
            <td class="px-4 py-3.5 text-right whitespace-nowrap">
              <div class="inline-flex items-center gap-1.5 justify-end">
                <button 
                  type="button" 
                  data-action="edit-member" 
                  data-id="${escapeHtml(member.id)}" 
                  class="p-2 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition" 
                  title="Edit Member">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </button>
                <button 
                  type="button" 
                  data-action="delete-member" 
                  data-id="${escapeHtml(member.id)}" 
                  class="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" 
                  title="Delete Member">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');

    container.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              <th class="px-4 py-3">Order</th>
              <th class="px-4 py-3">Member &amp; ID</th>
              <th class="px-4 py-3">Designation &amp; Company</th>
              <th class="px-4 py-3">Technology &amp; Idea</th>
              <th class="px-4 py-3">Grant / Funding</th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;

    // Attach row button events
    container.querySelectorAll('[data-action="edit-member"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const member = membersList.find((m) => String(m.id) === String(id));
        if (member) openEditMemberModal(member);
      });
    });

    container.querySelectorAll('[data-action="delete-member"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const member = membersList.find((m) => String(m.id) === String(id));
        if (member) openDeleteConfirm('member', member.id, member.name || 'Incubatee Member');
      });
    });
  }

  // Update photo UI preview and state
  function setMemberPhotoPreviewState({ file = null, existingUrl = '', error = '' }) {
    const placeholder = document.getElementById('memberPhotoPlaceholder');
    const img = document.getElementById('memberPhotoImg');
    const btnSelectText = document.getElementById('btnSelectPhotoText');
    const btnRemove = document.getElementById('btnRemovePhoto');
    const statusText = document.getElementById('memberPhotoStatusText');
    const errorEl = document.getElementById('memberPhotoError');
    const existingUrlInput = document.getElementById('memberExistingPhotoUrl');

    if (errorEl) {
      if (error) {
        errorEl.textContent = error;
        errorEl.classList.remove('hidden');
      } else {
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
      }
    }

    if (file) {
      // New file chosen
      pendingMemberPhotoFile = file;
      if (img) {
        img.src = URL.createObjectURL(file);
        img.classList.remove('hidden');
      }
      if (placeholder) placeholder.classList.add('hidden');
      if (btnSelectText) btnSelectText.textContent = 'Change Photo';
      if (btnRemove) btnRemove.classList.remove('hidden');
      if (statusText) {
        statusText.innerHTML = `<span class="font-bold text-slate-800">${escapeHtml(file.name)}</span> (${formatBytes(file.size)}) <span class="text-emerald-700 font-bold ml-1">• Ready to upload</span>`;
      }
    } else if (existingUrl) {
      // Existing photo loaded
      pendingMemberPhotoFile = null;
      if (existingUrlInput) existingUrlInput.value = existingUrl;
      if (img) {
        img.src = existingUrl;
        img.classList.remove('hidden');
      }
      if (placeholder) placeholder.classList.add('hidden');
      if (btnSelectText) btnSelectText.textContent = 'Replace Photo';
      if (btnRemove) btnRemove.classList.remove('hidden');
      if (statusText) {
        statusText.innerHTML = `<span class="text-slate-600 font-medium">Current profile photo active</span>`;
      }
    } else {
      // No photo
      pendingMemberPhotoFile = null;
      if (existingUrlInput) existingUrlInput.value = '';
      if (img) {
        img.src = '';
        img.classList.add('hidden');
      }
      if (placeholder) placeholder.classList.remove('hidden');
      if (btnSelectText) btnSelectText.textContent = 'Choose Image';
      if (btnRemove) btnRemove.classList.add('hidden');
      if (statusText) {
        statusText.textContent = 'Select a member portrait from your computer.';
      }
    }
  }

  // Member Modal Handlers
  function openAddMemberModal() {
    const modal = document.getElementById('memberModal');
    const form = document.getElementById('memberForm');
    const title = document.getElementById('memberModalTitle');
    const alertBox = document.getElementById('memberModalAlert');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('memberFormId').value = '';
    
    // Set default values for new fields
    const orderInput = document.getElementById('memberDisplayOrderInput');
    if (orderInput) orderInput.value = membersList.length + 1;
    
    const statusInput = document.getElementById('memberGrantStatusInput');
    if (statusInput) statusInput.value = 'Grant Sanctioned';
    
    const fundingInput = document.getElementById('memberFundingInput');
    if (fundingInput) fundingInput.value = '2 Lakhs';

    const categoryInput = document.getElementById('memberCategoryInput');
    if (categoryInput) categoryInput.value = 'sericulture';

    // Reset photo upload state
    const fileInput = document.getElementById('memberPhotoFileInput');
    if (fileInput) fileInput.value = '';
    setMemberPhotoPreviewState({ file: null, existingUrl: '', error: '' });

    if (title) title.textContent = 'Add New Incubatee Member';
    if (alertBox) alertBox.classList.add('hidden');

    modal.classList.remove('hidden');
    document.getElementById('memberNameInput')?.focus();
  }

  function openEditMemberModal(member) {
    const modal = document.getElementById('memberModal');
    const form = document.getElementById('memberForm');
    const title = document.getElementById('memberModalTitle');
    const alertBox = document.getElementById('memberModalAlert');
    if (!modal || !form || !member) return;

    form.reset();
    document.getElementById('memberFormId').value = member.id || '';
    document.getElementById('memberNameInput').value = member.name || '';
    document.getElementById('memberDesignationInput').value = member.designation || '';
    document.getElementById('memberCompanyInput').value = member.company || '';
    
    // Extended fields
    const ideaInput = document.getElementById('memberInnovativeIdeaInput');
    if (ideaInput) ideaInput.value = member.innovative_idea || '';

    const techInput = document.getElementById('memberTechnologyInput');
    if (techInput) techInput.value = member.technology || '';

    const catInput = document.getElementById('memberCategoryInput');
    if (catInput) catInput.value = member.category || 'sericulture';

    const fundingInput = document.getElementById('memberFundingInput');
    if (fundingInput) fundingInput.value = member.funding || '';

    const statusInput = document.getElementById('memberGrantStatusInput');
    if (statusInput) statusInput.value = member.grant_status || 'Grant Sanctioned';

    const orderInput = document.getElementById('memberDisplayOrderInput');
    if (orderInput) orderInput.value = member.display_order !== undefined && member.display_order !== null ? member.display_order : 0;

    // Reset file input & set existing photo
    const fileInput = document.getElementById('memberPhotoFileInput');
    if (fileInput) fileInput.value = '';
    setMemberPhotoPreviewState({ file: null, existingUrl: member.photo_url || '', error: '' });

    if (title) title.textContent = 'Edit Incubatee Member';
    if (alertBox) alertBox.classList.add('hidden');

    modal.classList.remove('hidden');
    document.getElementById('memberNameInput')?.focus();
  }

  function closeMemberModal() {
    const modal = document.getElementById('memberModal');
    if (modal) modal.classList.add('hidden');
    pendingMemberPhotoFile = null;
    const fileInput = document.getElementById('memberPhotoFileInput');
    if (fileInput) fileInput.value = '';
  }

  async function handleSaveMember(e) {
    e.preventDefault();
    const id = document.getElementById('memberFormId').value.trim();
    const name = document.getElementById('memberNameInput').value.trim();
    const designation = document.getElementById('memberDesignationInput').value.trim();
    const company = document.getElementById('memberCompanyInput').value.trim();
    const innovative_idea = document.getElementById('memberInnovativeIdeaInput')?.value.trim() || '';
    const technology = document.getElementById('memberTechnologyInput')?.value.trim() || '';
    const category = document.getElementById('memberCategoryInput')?.value.trim() || '';
    const funding = document.getElementById('memberFundingInput')?.value.trim() || '';
    const grant_status = document.getElementById('memberGrantStatusInput')?.value.trim() || 'Grant Sanctioned';
    const display_order_val = document.getElementById('memberDisplayOrderInput')?.value.trim();
    const display_order = display_order_val !== '' && !isNaN(display_order_val) ? parseInt(display_order_val, 10) : 0;

    let photo_url = document.getElementById('memberExistingPhotoUrl')?.value.trim() || null;
    let previousPhotoUrlToDelete = null;

    const alertBox = document.getElementById('memberModalAlert');
    const btn = document.getElementById('btnSaveMember');
    const btnText = document.getElementById('btnSaveMemberText');

    if (!name) {
      if (alertBox) {
        alertBox.className = 'p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs';
        alertBox.textContent = 'Member Name is required.';
        alertBox.classList.remove('hidden');
      }
      return;
    }

    // Loading button
    btn.disabled = true;
    if (pendingMemberPhotoFile) {
      btnText.textContent = 'Uploading photo...';
    } else {
      btnText.textContent = id ? 'Updating...' : 'Saving...';
    }

    try {
      // 1. Upload new photo to Supabase Storage if selected
      if (pendingMemberPhotoFile) {
        console.log('[Members] Uploading photo to Supabase Storage bucket "member-photos"...');
        const ext = pendingMemberPhotoFile.name.split('.').pop().toLowerCase() || 'jpg';
        const safeSlug = (name || 'member').toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 30);
        const fileName = `member_${safeSlug}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;

        const { data: uploadData, error: uploadErr } = await client.storage
          .from('member-photos')
          .upload(fileName, pendingMemberPhotoFile, {
            contentType: pendingMemberPhotoFile.type,
            cacheControl: '3600',
            upsert: false
          });

        if (uploadErr) {
          throw new Error(`Photo upload failed: ${uploadErr.message}`);
        }

        const { data: urlData } = client.storage
          .from('member-photos')
          .getPublicUrl(fileName);

        if (!urlData || !urlData.publicUrl) {
          throw new Error('Failed to obtain public URL for uploaded photo.');
        }

        // If replacing an existing photo stored in member-photos, mark it for deletion
        if (photo_url && photo_url.includes('/member-photos/')) {
          previousPhotoUrlToDelete = photo_url;
        }

        photo_url = urlData.publicUrl;
        btnText.textContent = id ? 'Updating...' : 'Saving...';
      }

      const payload = {
        name: name,
        designation: designation || null,
        company: company || null,
        innovative_idea: innovative_idea || null,
        technology: technology || null,
        category: category || null,
        funding: funding || null,
        grant_status: grant_status || 'Grant Sanctioned',
        display_order: display_order,
        photo_url: photo_url || null
      };

      let response;
      if (id) {
        // Edit
        response = await client
          .from('members')
          .update(payload)
          .eq('id', id)
          .select();
      } else {
        // Add
        response = await client
          .from('members')
          .insert([payload])
          .select();
      }

      // If category column does not exist yet in table, retry payload without category
      if (response.error && (response.error.code === '42703' || (response.error.message && response.error.message.includes('category')))) {
        console.warn('[Members] category column missing in Supabase, retrying without category...');
        delete payload.category;
        if (id) {
          response = await client.from('members').update(payload).eq('id', id).select();
        } else {
          response = await client.from('members').insert([payload]).select();
        }
      }

      if (response.error) {
        throw response.error;
      }

      // If previous storage photo was replaced, clean it up asynchronously
      if (previousPhotoUrlToDelete) {
        try {
          const oldStoragePath = previousPhotoUrlToDelete.split('/member-photos/')[1];
          if (oldStoragePath) {
            await client.storage.from('member-photos').remove([decodeURIComponent(oldStoragePath)]);
            console.log('[Storage Cleanup] Cleaned up replaced photo:', oldStoragePath);
          }
        } catch (cleanupErr) {
          console.warn('[Storage Cleanup Warning] Could not remove old photo:', cleanupErr);
        }
      }

      closeMemberModal();
      showToast('success', 'Member Saved', 'Member saved successfully.');
      await loadMembers();

    } catch (err) {
      console.error('[Members] Save error:', err);
      const friendlyErr = parseSupabaseError(err);
      if (alertBox) {
        alertBox.className = 'p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs leading-relaxed';
        alertBox.innerHTML = `<strong>Error saving member:</strong> ${escapeHtml(friendlyErr)}`;
        alertBox.classList.remove('hidden');
      }
      showToast('error', 'Save Failed', friendlyErr);
    } finally {
      btn.disabled = false;
      btnText.textContent = id ? 'Save Changes' : 'Save Member';
    }
  }

  // Automated Synchronization / Migration Helper for Authenticated Admin
  async function migrateExistingMembers() {
    const btn = document.getElementById('btnMigrateMembers');
    const btnText = document.getElementById('btnMigrateMembersText');
    const btnSpinner = document.getElementById('btnMigrateMembersSpinner');

    if (!confirm('This will synchronize all 17 verified incubatee members to Supabase. Any existing records matching these IDs will be updated with full card attributes. Proceed?')) {
      return;
    }

    if (btn) {
      btn.disabled = true;
      if (btnSpinner) btnSpinner.classList.remove('hidden');
      if (btnText) btnText.textContent = 'Syncing 17 Members...';
    }

    try {
      console.log('[Migration] Starting migration of 17 verified members to Supabase...');
      
      // Attempt upsert with complete dataset
      let { data, error } = await client
        .from('members')
        .upsert(VERIFIED_EXISTING_MEMBERS, { onConflict: 'id' })
        .select();

      // If category column does not exist yet in Supabase, strip category and retry
      if (error && (error.code === '42703' || (error.message && error.message.includes('category')))) {
        console.warn('[Migration] category column does not exist yet. Stripping category and retrying...');
        const membersWithoutCategory = VERIFIED_EXISTING_MEMBERS.map(m => {
          const copy = { ...m };
          delete copy.category;
          return copy;
        });
        const retryResult = await client
          .from('members')
          .upsert(membersWithoutCategory, { onConflict: 'id' })
          .select();
        data = retryResult.data;
        error = retryResult.error;
      }

      if (error) {
        throw error;
      }

      console.log('[Migration] Successfully synced 17 members to Supabase:', data);
      showToast('success', '17 Members Synced', 'All 17 incubatee members have been successfully migrated to Supabase.');
      await loadMembers();

    } catch (err) {
      console.error('[Migration] Migration error:', err);
      const friendlyErr = parseSupabaseError(err);
      showToast('error', 'Sync Failed', friendlyErr);
      alert('Migration failed: ' + friendlyErr + '\n\nAlternatively, you can run the generated SQL script "supabase_members_migration.sql" directly in the Supabase Dashboard SQL Editor.');
    } finally {
      if (btn) {
        btn.disabled = false;
        if (btnSpinner) btnSpinner.classList.add('hidden');
        if (btnText) btnText.textContent = 'Sync 17 Members';
      }
    }
  }

  // =========================================================================
  // MENTORS MODULE (public.mentors)
  // =========================================================================

  // VERIFIED TECHNICAL MENTORS DATASET (5 Mentors from mentors.html)
  const VERIFIED_EXISTING_MENTORS = [
    {
      id: 'b0000000-0000-0000-0000-000000000001',
      name: 'Dr. A. Balasubramanian',
      designation: 'Dean (Forestry) and Nodal Officer (MAFBIF)',
      institution: 'Forest College and Research Institute, Mettupalayam',
      specialization: 'Agroforestry Leadership & Incubation Nodal Head',
      photo_url: 'https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=768,fit=crop/iX3h8rqPfxJk6DDB/dean-photo-ePd3q9KTKLKY1jBp.jpeg',
      display_order: 1
    },
    {
      id: 'b0000000-0000-0000-0000-000000000002',
      name: 'Dr. Prasanth Rajan',
      designation: 'Asst. Prof',
      institution: 'FC&RI Mettupalayam',
      specialization: 'Essential oils',
      photo_url: null,
      display_order: 2
    },
    {
      id: 'b0000000-0000-0000-0000-000000000003',
      name: 'Dr. Umesh Kanna',
      designation: 'Assoc. Prof',
      institution: 'FC&RI Mettupalayam',
      specialization: 'Nursery',
      photo_url: null,
      display_order: 3
    },
    {
      id: 'b0000000-0000-0000-0000-000000000004',
      name: 'Dr. I. Sekar',
      designation: 'Professor',
      institution: 'TNAU',
      specialization: 'Wood seasoning and preservation',
      photo_url: null,
      display_order: 4
    },
    {
      id: 'b0000000-0000-0000-0000-000000000005',
      name: 'Dr. Cinthiya Fernandas',
      designation: 'Assoc. Prof',
      institution: 'FC&RI Mettupalayam',
      specialization: 'Vermicompost',
      photo_url: null,
      display_order: 5
    }
  ];

  // Helper: Manage Mentor Photo Preview Box UI state
  function setMentorPhotoPreviewState({ file, existingUrl, error }) {
    const placeholder = document.getElementById('mentorPhotoPlaceholder');
    const img = document.getElementById('mentorPhotoImg');
    const btnSelectText = document.getElementById('btnSelectMentorPhotoText');
    const btnRemove = document.getElementById('btnRemoveMentorPhoto');
    const statusText = document.getElementById('mentorPhotoStatusText');
    const errorEl = document.getElementById('mentorPhotoError');
    const existingUrlInput = document.getElementById('mentorExistingPhotoUrl');

    if (errorEl) {
      if (error) {
        errorEl.textContent = error;
        errorEl.classList.remove('hidden');
      } else {
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
      }
    }

    if (file) {
      // New file chosen
      pendingMentorPhotoFile = file;
      if (img) {
        img.src = URL.createObjectURL(file);
        img.classList.remove('hidden');
      }
      if (placeholder) placeholder.classList.add('hidden');
      if (btnSelectText) btnSelectText.textContent = 'Change Photo';
      if (btnRemove) btnRemove.classList.remove('hidden');
      if (statusText) {
        statusText.innerHTML = `<span class="font-bold text-slate-800">${escapeHtml(file.name)}</span> (${formatBytes(file.size)}) <span class="text-amber-700 font-bold ml-1">• Ready to upload</span>`;
      }
    } else if (existingUrl) {
      // Existing photo loaded
      pendingMentorPhotoFile = null;
      if (existingUrlInput) existingUrlInput.value = existingUrl;
      if (img) {
        img.src = existingUrl;
        img.classList.remove('hidden');
      }
      if (placeholder) placeholder.classList.add('hidden');
      if (btnSelectText) btnSelectText.textContent = 'Replace Photo';
      if (btnRemove) btnRemove.classList.remove('hidden');
      if (statusText) {
        statusText.innerHTML = `<span class="text-slate-600 font-medium">Current profile photo active</span>`;
      }
    } else {
      // No photo
      pendingMentorPhotoFile = null;
      if (existingUrlInput) existingUrlInput.value = '';
      if (img) {
        img.src = '';
        img.classList.add('hidden');
      }
      if (placeholder) placeholder.classList.remove('hidden');
      if (btnSelectText) btnSelectText.textContent = 'Choose Image';
      if (btnRemove) btnRemove.classList.add('hidden');
      if (statusText) {
        statusText.textContent = 'Select a mentor photo from your computer (optional).';
      }
    }
  }

  async function loadMentors() {
    const container = document.getElementById('mentorsContainer');
    const alertBox = document.getElementById('mentorsAlert');
    const countBadge = document.getElementById('mentorsCountBadge');
    if (!container) return;

    if (alertBox) alertBox.classList.add('hidden');

    // Loading State
    container.innerHTML = `
      <div class="py-16 px-6 text-center flex flex-col items-center justify-center">
        <svg class="animate-spin h-8 w-8 text-[#CFA851] mb-3" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p class="text-xs font-bold text-slate-700">Connecting to Supabase...</p>
        <p class="text-[11px] text-slate-400 mt-1">Fetching records from public.mentors</p>
      </div>
    `;

    try {
      const { data, error } = await client
        .from('mentors')
        .select('*');

      if (error) {
        throw error;
      }

      mentorsList = Array.isArray(data) ? data : [];
      // Sort by display_order ascending, then name
      mentorsList.sort((a, b) => {
        const orderA = a.display_order !== null && a.display_order !== undefined ? Number(a.display_order) : 999;
        const orderB = b.display_order !== null && b.display_order !== undefined ? Number(b.display_order) : 999;
        if (orderA !== orderB) return orderA - orderB;
        return (a.name || '').localeCompare(b.name || '');
      });

      if (countBadge) {
        countBadge.textContent = mentorsList.length;
      }

      renderMentors(mentorsList);

    } catch (err) {
      console.error('[Mentors] Fetch error:', err);
      const errorMsg = parseSupabaseError(err);

      if (alertBox) {
        alertBox.className = 'mb-6 p-4 rounded-2xl border border-rose-200 bg-rose-50/80 text-rose-900 text-xs flex items-start gap-3';
        alertBox.innerHTML = `
          <svg class="w-5 h-5 text-rose-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <div class="flex-1">
            <p class="font-bold">Failed to load mentors from Supabase</p>
            <p class="mt-0.5 leading-relaxed">${escapeHtml(errorMsg)}</p>
          </div>
        `;
        alertBox.classList.remove('hidden');
      }

      container.innerHTML = `
        <div class="py-12 px-6 text-center">
          <div class="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 mx-auto flex items-center justify-center mb-3 border border-rose-100">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          </div>
          <h4 class="text-sm font-bold text-slate-800">Database Connection Error</h4>
          <p class="text-xs text-slate-500 mt-1 max-w-md mx-auto">${escapeHtml(errorMsg)}</p>
          <button type="button" onclick="window.adminModules.loadMentors()" class="mt-4 px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition">
            Try Again
          </button>
        </div>
      `;
    }
  }

  function renderMentors(list) {
    const container = document.getElementById('mentorsContainer');
    if (!container) return;

    if (!list || list.length === 0) {
      container.innerHTML = `
        <div class="py-16 px-6 text-center">
          <div class="w-14 h-14 rounded-2xl bg-amber-50 text-amber-800 border border-amber-200/80 mx-auto flex items-center justify-center mb-3.5 shadow-xs">
            <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>
          </div>
          <h4 class="text-sm sm:text-base font-bold text-[#0A2E1C]">No Mentors Registered Yet</h4>
          <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
            The <code class="text-amber-800 font-mono">public.mentors</code> table currently has no records. You can synchronize the 5 verified technical mentors or add a mentor manually.
          </p>
          <div class="mt-5 flex items-center justify-center gap-3">
            <button type="button" onclick="window.adminModules.migrateExistingMentors()" class="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-xl transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              <span>Sync 5 Mentors</span>
            </button>
            <button type="button" onclick="window.adminModules.openAddMentorModal()" class="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-[#CFA851] hover:bg-[#b89340] rounded-xl shadow-sm transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
              <span>Add Mentor</span>
            </button>
          </div>
        </div>
      `;
      return;
    }

    // Responsive Table
    let rowsHtml = list
      .map((mentor) => {
        const photoHtml = mentor.photo_url
          ? `<img src="${escapeHtml(mentor.photo_url)}" alt="${escapeHtml(mentor.name || '')}" class="w-10 h-11 rounded-xl object-cover object-top border border-amber-200/80 shadow-2xs shrink-0" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'w-10 h-10 rounded-xl bg-amber-50 text-amber-800 font-bold text-xs flex items-center justify-center border border-amber-200/80 shrink-0\\'>${escapeHtml((mentor.name || 'M').charAt(0).toUpperCase())}</div>';">`
          : `<div class="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 font-bold text-xs flex items-center justify-center border border-amber-200/80 shrink-0">${escapeHtml((mentor.name || 'M').charAt(0).toUpperCase())}</div>`;

        return `
          <tr class="hover:bg-slate-50/70 transition-colors border-b border-slate-100 last:border-b-0 text-xs">
            <td class="px-5 py-3.5 whitespace-nowrap">
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60 font-mono">
                #${mentor.display_order !== null && mentor.display_order !== undefined ? mentor.display_order : '—'}
              </span>
            </td>
            <td class="px-5 py-3.5">
              <div class="flex items-center gap-3">
                ${photoHtml}
                <div>
                  <p class="font-bold text-[#0A2E1C]">${escapeHtml(mentor.name || 'Untitled')}</p>
                  <p class="text-[11px] text-slate-400 font-mono mt-0.5 truncate max-w-[180px]">${escapeHtml(mentor.id)}</p>
                </div>
              </div>
            </td>
            <td class="px-5 py-3.5 text-slate-600 font-medium">
              ${escapeHtml(mentor.designation || '—')}
            </td>
            <td class="px-5 py-3.5 text-slate-700">
              ${
                mentor.institution
                  ? `<span class="font-medium">${escapeHtml(mentor.institution)}</span>`
                  : `<span class="text-slate-400">—</span>`
              }
            </td>
            <td class="px-5 py-3.5">
              ${
                mentor.specialization
                  ? `<span class="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200/60 max-w-[240px] truncate" title="${escapeHtml(mentor.specialization)}">${escapeHtml(mentor.specialization)}</span>`
                  : `<span class="text-slate-400">—</span>`
              }
            </td>
            <td class="px-5 py-3.5 text-right whitespace-nowrap">
              <div class="inline-flex items-center gap-1.5 justify-end">
                <button 
                  type="button" 
                  data-action="edit-mentor" 
                  data-id="${escapeHtml(mentor.id)}" 
                  class="p-2 text-slate-500 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition" 
                  title="Edit Mentor">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </button>
                <button 
                  type="button" 
                  data-action="delete-mentor" 
                  data-id="${escapeHtml(mentor.id)}" 
                  class="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" 
                  title="Delete Mentor">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');

    container.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              <th class="px-5 py-3">Order</th>
              <th class="px-5 py-3">Mentor &amp; Portrait</th>
              <th class="px-5 py-3">Designation</th>
              <th class="px-5 py-3">Institution / Affiliation</th>
              <th class="px-5 py-3">Specialization</th>
              <th class="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;

    // Attach row button events
    container.querySelectorAll('[data-action="edit-mentor"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const mentor = mentorsList.find((m) => String(m.id) === String(id));
        if (mentor) openEditMentorModal(mentor);
      });
    });

    container.querySelectorAll('[data-action="delete-mentor"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const mentor = mentorsList.find((m) => String(m.id) === String(id));
        if (mentor) openDeleteConfirm('mentor', mentor.id, mentor.name || 'Technical Mentor');
      });
    });
  }

  // Mentor Modal Handlers
  function openAddMentorModal() {
    const modal = document.getElementById('mentorModal');
    const form = document.getElementById('mentorForm');
    const title = document.getElementById('mentorModalTitle');
    const alertBox = document.getElementById('mentorModalAlert');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('mentorFormId').value = '';

    // Set next display order default
    const orderInput = document.getElementById('mentorDisplayOrderInput');
    if (orderInput) orderInput.value = mentorsList.length + 1;

    // Reset photo upload state
    const fileInput = document.getElementById('mentorPhotoFileInput');
    if (fileInput) fileInput.value = '';
    setMentorPhotoPreviewState({ file: null, existingUrl: '', error: '' });

    if (title) title.textContent = 'Add New Technical Mentor';
    if (alertBox) alertBox.classList.add('hidden');

    modal.classList.remove('hidden');
    document.getElementById('mentorNameInput')?.focus();
  }

  function openEditMentorModal(mentor) {
    const modal = document.getElementById('mentorModal');
    const form = document.getElementById('mentorForm');
    const title = document.getElementById('mentorModalTitle');
    const alertBox = document.getElementById('mentorModalAlert');
    if (!modal || !form || !mentor) return;

    form.reset();
    document.getElementById('mentorFormId').value = mentor.id || '';
    document.getElementById('mentorNameInput').value = mentor.name || '';
    document.getElementById('mentorDesignationInput').value = mentor.designation || '';
    document.getElementById('mentorInstitutionInput').value = mentor.institution || '';
    document.getElementById('mentorSpecializationInput').value = mentor.specialization || '';

    const orderInput = document.getElementById('mentorDisplayOrderInput');
    if (orderInput) orderInput.value = mentor.display_order !== undefined && mentor.display_order !== null ? mentor.display_order : (mentorsList.length + 1);

    // Reset file input & set existing photo
    const fileInput = document.getElementById('mentorPhotoFileInput');
    if (fileInput) fileInput.value = '';
    setMentorPhotoPreviewState({ file: null, existingUrl: mentor.photo_url || '', error: '' });

    if (title) title.textContent = 'Edit Technical Mentor';
    if (alertBox) alertBox.classList.add('hidden');

    modal.classList.remove('hidden');
    document.getElementById('mentorNameInput')?.focus();
  }

  function closeMentorModal() {
    const modal = document.getElementById('mentorModal');
    if (modal) modal.classList.add('hidden');
    pendingMentorPhotoFile = null;
    const fileInput = document.getElementById('mentorPhotoFileInput');
    if (fileInput) fileInput.value = '';
  }

  async function handleSaveMentor(e) {
    e.preventDefault();
    const id = document.getElementById('mentorFormId').value.trim();
    const name = document.getElementById('mentorNameInput').value.trim();
    const designation = document.getElementById('mentorDesignationInput').value.trim();
    const institution = document.getElementById('mentorInstitutionInput').value.trim();
    const specialization = document.getElementById('mentorSpecializationInput').value.trim();
    const display_order_val = document.getElementById('mentorDisplayOrderInput')?.value.trim();
    const display_order = display_order_val !== '' && !isNaN(display_order_val) ? parseInt(display_order_val, 10) : 999;

    let photo_url = document.getElementById('mentorExistingPhotoUrl')?.value.trim() || null;
    let previousPhotoUrlToDelete = null;

    const alertBox = document.getElementById('mentorModalAlert');
    const btn = document.getElementById('btnSaveMentor');
    const btnText = document.getElementById('btnSaveMentorText');

    if (!name) {
      if (alertBox) {
        alertBox.className = 'p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs';
        alertBox.textContent = 'Mentor Name is required.';
        alertBox.classList.remove('hidden');
      }
      return;
    }

    // Loading button
    btn.disabled = true;
    if (pendingMentorPhotoFile) {
      btnText.textContent = 'Uploading photo...';
    } else {
      btnText.textContent = id ? 'Updating...' : 'Saving...';
    }

    try {
      // 1. Upload new photo to Supabase Storage if selected
      if (pendingMentorPhotoFile) {
        console.log('[Mentors] Uploading photo to Supabase Storage bucket "mentor-photos"...');
        const ext = pendingMentorPhotoFile.name.split('.').pop().toLowerCase() || 'jpg';
        const safeSlug = (name || 'mentor').toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 30);
        const fileName = `mentor_${safeSlug}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;

        const { data: uploadData, error: uploadErr } = await client.storage
          .from('mentor-photos')
          .upload(fileName, pendingMentorPhotoFile, {
            contentType: pendingMentorPhotoFile.type,
            cacheControl: '3600',
            upsert: false
          });

        if (uploadErr) {
          throw new Error(`Photo upload failed: ${uploadErr.message}`);
        }

        const { data: urlData } = client.storage
          .from('mentor-photos')
          .getPublicUrl(fileName);

        if (!urlData || !urlData.publicUrl) {
          throw new Error('Failed to obtain public URL for uploaded photo.');
        }

        // If replacing an existing photo stored in mentor-photos, mark it for deletion
        if (photo_url && photo_url.includes('/mentor-photos/')) {
          previousPhotoUrlToDelete = photo_url;
        }

        photo_url = urlData.publicUrl;
        btnText.textContent = id ? 'Updating...' : 'Saving...';
      }

      const payload = {
        name: name,
        designation: designation || null,
        institution: institution || null,
        specialization: specialization || null,
        photo_url: photo_url || null,
        display_order: display_order
      };

      let response;
      if (id) {
        // Edit
        response = await client
          .from('mentors')
          .update(payload)
          .eq('id', id)
          .select();
      } else {
        // Add
        response = await client
          .from('mentors')
          .insert([payload])
          .select();
      }

      if (response.error) {
        throw response.error;
      }

      // If previous storage photo was replaced, clean it up asynchronously
      if (previousPhotoUrlToDelete) {
        try {
          const oldStoragePath = previousPhotoUrlToDelete.split('/mentor-photos/')[1];
          if (oldStoragePath) {
            await client.storage.from('mentor-photos').remove([decodeURIComponent(oldStoragePath)]);
            console.log('[Storage Cleanup] Cleaned up replaced mentor photo:', oldStoragePath);
          }
        } catch (cleanupErr) {
          console.warn('[Storage Cleanup Warning] Could not remove old mentor photo:', cleanupErr);
        }
      }

      closeMentorModal();
      showToast('success', 'Mentor Saved', `${name} has been successfully ${id ? 'updated' : 'added'} in Supabase.`);
      await loadMentors();

    } catch (err) {
      console.error('[Mentors] Save error:', err);
      const friendlyErr = parseSupabaseError(err);
      if (alertBox) {
        alertBox.className = 'p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs leading-relaxed';
        alertBox.innerHTML = `<strong>Error saving mentor:</strong> ${escapeHtml(friendlyErr)}`;
        alertBox.classList.remove('hidden');
      }
      showToast('error', 'Save Failed', friendlyErr);
    } finally {
      btn.disabled = false;
      btnText.textContent = id ? 'Save Changes' : 'Save Mentor';
    }
  }

  // Automated Synchronization / Migration Helper for Authenticated Admin
  async function migrateExistingMentors() {
    const btn = document.getElementById('btnMigrateMentors');
    const btnText = document.getElementById('btnMigrateMentorsText');
    const btnSpinner = document.getElementById('btnMigrateMentorsSpinner');

    if (!confirm('This will synchronize all 5 verified technical mentors to Supabase. Any existing records matching these IDs will be updated. Proceed?')) {
      return;
    }

    if (btn) {
      btn.disabled = true;
      if (btnSpinner) btnSpinner.classList.remove('hidden');
      if (btnText) btnText.textContent = 'Syncing 5 Mentors...';
    }

    try {
      console.log('[Migration] Starting migration of 5 verified mentors to Supabase...');
      const { data, error } = await client
        .from('mentors')
        .upsert(VERIFIED_EXISTING_MENTORS, { onConflict: 'id' })
        .select();

      if (error) {
        throw error;
      }

      console.log('[Migration] Successfully synced 5 mentors to Supabase:', data);
      showToast('success', '5 Mentors Synced', 'All 5 technical mentors have been successfully migrated to Supabase.');
      await loadMentors();

    } catch (err) {
      console.error('[Migration] Mentor migration error:', err);
      const friendlyErr = parseSupabaseError(err);
      showToast('error', 'Sync Failed', friendlyErr);
    } finally {
      if (btn) {
        btn.disabled = false;
        if (btnSpinner) btnSpinner.classList.add('hidden');
        if (btnText) btnText.textContent = 'Sync 5 Mentors';
      }
    }
  }

  // =========================================================================
  // GENERIC DELETE CONFIRMATION MODAL
  // =========================================================================

  function openDeleteConfirm(type, id, name) {
    currentDeleteTarget = { type, id, name };
    const modal = document.getElementById('deleteConfirmModal');
    const nameEl = document.getElementById('deleteTargetName');
    const tableEl = document.getElementById('deleteTargetTable');
    const alertBox = document.getElementById('deleteModalAlert');
    if (!modal) return;

    if (nameEl) nameEl.textContent = `"${name}"`;
    if (tableEl) tableEl.textContent = type === 'member' ? 'public.members' : 'public.mentors';
    if (alertBox) alertBox.classList.add('hidden');

    modal.classList.remove('hidden');
  }

  function closeDeleteConfirm() {
    const modal = document.getElementById('deleteConfirmModal');
    if (modal) modal.classList.add('hidden');
    currentDeleteTarget = null;
  }

  async function handleConfirmDelete() {
    if (!currentDeleteTarget || !currentDeleteTarget.id) return;

    const { type, id, name } = currentDeleteTarget;
    const btn = document.getElementById('btnConfirmDelete');
    const btnText = document.getElementById('btnConfirmDeleteText');
    const alertBox = document.getElementById('deleteModalAlert');

    btn.disabled = true;
    btnText.textContent = 'Deleting...';

    const tableName = type === 'member' ? 'members' : 'mentors';
    const memberToDelete = type === 'member' ? membersList.find((m) => String(m.id) === String(id)) : null;
    const photoUrl = memberToDelete?.photo_url;

    try {
      const { error } = await client
        .from(tableName)
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      // If member had a photo stored in member-photos, attempt to remove it from storage
      if (type === 'member' && photoUrl && photoUrl.includes('/member-photos/')) {
        try {
          const storagePath = photoUrl.split('/member-photos/')[1];
          if (storagePath) {
            const { error: storageDelErr } = await client.storage
              .from('member-photos')
              .remove([decodeURIComponent(storagePath)]);
            if (storageDelErr) {
              console.warn('[Storage Cleanup Warning] Photo delete returned error:', storageDelErr);
              showToast('info', 'Storage Notice', 'Member was deleted, but photo cleanup returned a warning.');
            }
          }
        } catch (storageCleanupErr) {
          console.warn('[Storage Cleanup Error]', storageCleanupErr);
        }
      }

      // If mentor had a photo stored in mentor-photos, attempt to remove it from storage
      const mentorToDelete = type === 'mentor' ? mentorsList.find((m) => String(m.id) === String(id)) : null;
      const mentorPhotoUrl = mentorToDelete?.photo_url;
      if (type === 'mentor' && mentorPhotoUrl && mentorPhotoUrl.includes('/mentor-photos/')) {
        try {
          const storagePath = mentorPhotoUrl.split('/mentor-photos/')[1];
          if (storagePath) {
            const { error: storageDelErr } = await client.storage
              .from('mentor-photos')
              .remove([decodeURIComponent(storagePath)]);
            if (storageDelErr) {
              console.warn('[Storage Cleanup Warning] Mentor photo delete returned error:', storageDelErr);
              showToast('info', 'Storage Notice', 'Mentor was deleted, but photo cleanup returned a warning.');
            }
          }
        } catch (storageCleanupErr) {
          console.warn('[Storage Cleanup Error]', storageCleanupErr);
        }
      }

      closeDeleteConfirm();
      showToast('success', 'Record Deleted', `${name} was successfully removed from ${tableName}.`);

      if (type === 'member') {
        await loadMembers();
      } else {
        await loadMentors();
      }

    } catch (err) {
      console.error(`[${tableName}] Delete error:`, err);
      const friendlyErr = parseSupabaseError(err);
      if (alertBox) {
        alertBox.className = 'mt-3 p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs';
        alertBox.innerHTML = `<strong>Delete failed:</strong> ${escapeHtml(friendlyErr)}`;
        alertBox.classList.remove('hidden');
      }
      showToast('error', 'Deletion Failed', friendlyErr);
    } finally {
      btn.disabled = false;
      btnText.textContent = 'Yes, Delete';
    }
  }

  // =========================================================================
  // SEARCH FILTERING
  // =========================================================================

  function filterMembers(query) {
    const q = (query || '').toLowerCase().trim();
    if (!q) {
      renderMembers(membersList);
      return;
    }
    const filtered = membersList.filter(
      (m) =>
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.designation && m.designation.toLowerCase().includes(q)) ||
        (m.company && m.company.toLowerCase().includes(q)) ||
        (m.technology && m.technology.toLowerCase().includes(q)) ||
        (m.innovative_idea && m.innovative_idea.toLowerCase().includes(q))
    );
    renderMembers(filtered);
  }

  function filterMentors(query) {
    const q = (query || '').toLowerCase().trim();
    if (!q) {
      renderMentors(mentorsList);
      return;
    }
    const filtered = mentorsList.filter(
      (m) =>
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.designation && m.designation.toLowerCase().includes(q)) ||
        (m.institution && m.institution.toLowerCase().includes(q)) ||
        (m.specialization && m.specialization.toLowerCase().includes(q))
    );
    renderMentors(filtered);
  }

  // =========================================================================
  // MODULE INITIALIZER
  // =========================================================================

  function initAdminModules(supabaseClient) {
    client = supabaseClient || window.supabaseClient;
    if (!client) {
      console.error('[Admin Modules] Supabase client is missing.');
      return;
    }

    console.log('[Admin Modules] Initializing Members & Mentors CRUD Modules (Phase 2)...');

    // Navigation Buttons
    document.getElementById('btnManageMembers')?.addEventListener('click', () => switchView('members'));
    document.getElementById('btnManageMentors')?.addEventListener('click', () => switchView('mentors'));
    document.getElementById('btnBackFromMembers')?.addEventListener('click', () => switchView('overview'));
    document.getElementById('btnBackFromMentors')?.addEventListener('click', () => switchView('overview'));

    // Refresh Buttons
    document.getElementById('btnRefreshMembers')?.addEventListener('click', loadMembers);
    document.getElementById('btnRefreshMentors')?.addEventListener('click', loadMentors);

    // Sync / Migration Buttons
    document.getElementById('btnMigrateMembers')?.addEventListener('click', migrateExistingMembers);
    document.getElementById('btnMigrateMentors')?.addEventListener('click', migrateExistingMentors);

    // Add Buttons
    document.getElementById('btnAddMember')?.addEventListener('click', openAddMemberModal);
    document.getElementById('btnAddMentor')?.addEventListener('click', openAddMentorModal);

    // Modal Close Buttons
    document.querySelectorAll('.btn-close-member-modal').forEach((btn) => {
      btn.addEventListener('click', closeMemberModal);
    });
    document.querySelectorAll('.btn-close-mentor-modal').forEach((btn) => {
      btn.addEventListener('click', closeMentorModal);
    });

    // Forms
    document.getElementById('memberForm')?.addEventListener('submit', handleSaveMember);
    document.getElementById('mentorForm')?.addEventListener('submit', handleSaveMentor);

    // Member Photo File Upload Listeners
    const btnSelectPhoto = document.getElementById('btnSelectPhoto');
    const photoFileInput = document.getElementById('memberPhotoFileInput');
    const btnRemovePhoto = document.getElementById('btnRemovePhoto');

    if (btnSelectPhoto && photoFileInput) {
      btnSelectPhoto.addEventListener('click', () => {
        photoFileInput.click();
      });

      photoFileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        // Allowed formats: JPG, JPEG, PNG, WEBP
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
        const fileExt = '.' + (file.name.split('.').pop() || '').toLowerCase();

        if (!validTypes.includes(file.type) && !validExtensions.includes(fileExt)) {
          setMemberPhotoPreviewState({
            file: null,
            existingUrl: document.getElementById('memberExistingPhotoUrl')?.value || '',
            error: 'Invalid file format. Please choose a JPG, PNG, or WebP image.'
          });
          photoFileInput.value = '';
          return;
        }

        // Max file size: 5 MB (5,242,880 bytes)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
          setMemberPhotoPreviewState({
            file: null,
            existingUrl: document.getElementById('memberExistingPhotoUrl')?.value || '',
            error: `File is too large (${formatBytes(file.size)}). Maximum allowed size is 5 MB.`
          });
          photoFileInput.value = '';
          return;
        }

        // Valid file selected
        setMemberPhotoPreviewState({ file: file, existingUrl: '', error: '' });
      });
    }

    if (btnRemovePhoto) {
      btnRemovePhoto.addEventListener('click', () => {
        if (photoFileInput) photoFileInput.value = '';
        setMemberPhotoPreviewState({ file: null, existingUrl: '', error: '' });
      });
    }

    // Mentor Photo File Upload Listeners
    const btnSelectMentorPhoto = document.getElementById('btnSelectMentorPhoto');
    const mentorPhotoFileInput = document.getElementById('mentorPhotoFileInput');
    const btnRemoveMentorPhoto = document.getElementById('btnRemoveMentorPhoto');

    if (btnSelectMentorPhoto && mentorPhotoFileInput) {
      btnSelectMentorPhoto.addEventListener('click', () => {
        mentorPhotoFileInput.click();
      });

      mentorPhotoFileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        // Allowed formats: JPG, JPEG, PNG, WEBP
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
        const fileExt = '.' + (file.name.split('.').pop() || '').toLowerCase();

        if (!validTypes.includes(file.type) && !validExtensions.includes(fileExt)) {
          setMentorPhotoPreviewState({
            file: null,
            existingUrl: document.getElementById('mentorExistingPhotoUrl')?.value || '',
            error: 'Invalid file format. Please choose a JPG, PNG, or WebP image.'
          });
          mentorPhotoFileInput.value = '';
          return;
        }

        // Max file size: 5 MB (5,242,880 bytes)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
          setMentorPhotoPreviewState({
            file: null,
            existingUrl: document.getElementById('mentorExistingPhotoUrl')?.value || '',
            error: `File is too large (${formatBytes(file.size)}). Maximum allowed size is 5 MB.`
          });
          mentorPhotoFileInput.value = '';
          return;
        }

        // Valid file selected
        setMentorPhotoPreviewState({ file: file, existingUrl: '', error: '' });
      });
    }

    if (btnRemoveMentorPhoto) {
      btnRemoveMentorPhoto.addEventListener('click', () => {
        if (mentorPhotoFileInput) mentorPhotoFileInput.value = '';
        setMentorPhotoPreviewState({ file: null, existingUrl: '', error: '' });
      });
    }

    // Delete Modal
    document.getElementById('btnCancelDelete')?.addEventListener('click', closeDeleteConfirm);
    document.getElementById('btnConfirmDelete')?.addEventListener('click', handleConfirmDelete);

    // Search Inputs
    document.getElementById('membersSearchInput')?.addEventListener('input', (e) => filterMembers(e.target.value));
    document.getElementById('mentorsSearchInput')?.addEventListener('input', (e) => filterMentors(e.target.value));

    // Backdrop click dismiss for modals
    ['memberModal', 'mentorModal', 'deleteConfirmModal'].forEach((modalId) => {
      const modalEl = document.getElementById(modalId);
      if (modalEl) {
        modalEl.addEventListener('click', (e) => {
          if (e.target === modalEl) {
            modalEl.classList.add('hidden');
          }
        });
      }
    });

    // Keyboard ESC listener
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeMemberModal();
        closeMentorModal();
        closeDeleteConfirm();
      }
    });

    // Check URL Hash on initial load
    if (window.location.hash === '#members') {
      switchView('members');
    } else if (window.location.hash === '#mentors') {
      switchView('mentors');
    }

    // Expose on window for programmatic access or onclick helpers
    window.adminModules = {
      switchView,
      loadMembers,
      loadMentors,
      openAddMemberModal,
      openEditMemberModal,
      openAddMentorModal,
      openEditMentorModal,
      migrateExistingMembers,
      migrateExistingMentors,
      showToast
    };
  }

  // Expose global initializer
  window.initAdminModules = initAdminModules;
})();
