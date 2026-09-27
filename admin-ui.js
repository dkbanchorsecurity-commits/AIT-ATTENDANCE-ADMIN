// --- Sidebar Toggle ---
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');
    sidebar.classList.toggle('-translate-x-full');
    if (overlay.classList.contains('hidden')) {
        overlay.classList.remove('hidden');
        setTimeout(() => overlay.classList.add('opacity-100'), 10);
    } else {
        overlay.classList.remove('opacity-100');
        setTimeout(() => overlay.classList.add('hidden'), 300);
    }
}

// --- Modal Management ---
function openModal(modalId) { 
    document.getElementById(modalId).classList.add('active'); 
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    if(modalId === 'course-modal') {
        document.getElementById('course-form').reset();
        document.getElementById('course-id').value = '';
        document.getElementById('course-modal-title').innerText = 'Add New Course';
    }
    if(modalId === 'lecturer-modal') {
        document.getElementById('lecturer-form').reset();
        document.getElementById('lecturer-id').value = '';
        document.getElementById('lecturer-modal-title').innerText = 'Add Lecturer';
    }
}

// --- Toast Notifications ---
function showMessage(msg, type = "success") {
    const box = document.getElementById('message-box');
    const icon = box.querySelector('i');
    document.getElementById('message-text').innerText = msg;
    
    if (type === "error") {
        icon.className = "fa-solid fa-circle-exclamation text-red-400 flex-shrink-0";
        box.classList.replace('bg-slate-800', 'bg-red-900');
    } else {
        icon.className = "fa-solid fa-circle-check text-green-400 flex-shrink-0";
        box.classList.replace('bg-red-900', 'bg-slate-800');
    }

    box.classList.remove('translate-y-24', 'opacity-0');
    setTimeout(() => box.classList.add('translate-y-24', 'opacity-0'), 3000);
}

// --- Formatting Helpers ---
function toTitleCase(str) {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function getStatusBadge(status) {
    const baseClass = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold";
    if (status === 'present') return `<span class="${baseClass} bg-emerald-100 text-emerald-700"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Present</span>`;
    if (status === 'late') return `<span class="${baseClass} bg-amber-100 text-amber-700"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Late</span>`;
    return `<span class="${baseClass} bg-red-100 text-red-700"><span class="w-1.5 h-1.5 rounded-full bg-red-500"></span> Absent</span>`;
}

function getGpsLink(gps) {
    if (!gps || gps === '-') return '-';
    return `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(gps)}" target="_blank" class="text-blue-600 hover:text-blue-800 hover:underline transition-colors inline-flex items-center gap-1"><i class="fa-solid fa-map-location-dot"></i> ${gps}</a>`;
}

// --- Theme & Dark Mode Logic ---
function initTheme() {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
        updateThemeToggleUI(true);
    } else {
        document.documentElement.classList.remove('dark');
        updateThemeToggleUI(false);
    }
}

function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.theme = isDark ? 'dark' : 'light';
    updateThemeToggleUI(isDark);
    
    // Dynamically update Chart.js labels if the chart exists
    const chart = typeof window.getChartInstance === 'function' ? window.getChartInstance() : null;
    if (chart) {
        chart.options.scales.x.ticks.color = isDark ? '#cbd5e1' : '#64748b';
        chart.options.scales.y.ticks.color = isDark ? '#cbd5e1' : '#64748b';
        chart.options.plugins.legend.labels.color = isDark ? '#f8fafc' : '#475569';
        chart.update();
    }
}

function updateThemeToggleUI(isDark) {
    const btn = document.getElementById('theme-toggle-btn');
    const knob = document.getElementById('theme-toggle-knob');
    if (btn && knob) {
        if (isDark) {
            btn.classList.replace('bg-slate-300', 'bg-blue-600');
            knob.classList.replace('translate-x-1', 'translate-x-6');
        } else {
            btn.classList.replace('bg-blue-600', 'bg-slate-300');
            knob.classList.replace('translate-x-6', 'translate-x-1');
        }
    }
}

// Run immediately to prevent a white-flash on load
initTheme();

// Expose standard functions for HTML attributes
window.toggleSidebar = toggleSidebar;
window.openModal = openModal;
window.closeModal = closeModal;
window.showMessage = showMessage;
window.toggleTheme = toggleTheme;