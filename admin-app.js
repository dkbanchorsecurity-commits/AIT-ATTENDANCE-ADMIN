import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDVqMmPMCDX5JFb85kTlfm6fCk8cNKciH4",
    authDomain: "ait-attendance-20bb6.firebaseapp.com",
    projectId: "ait-attendance-20bb6",
    storageBucket: "ait-attendance-20bb6.firebasestorage.app",
    messagingSenderId: "262056210376",
    appId: "1:262056210376:web:c8a7260a8491f932a69afd",
    measurementId: "G-1GBE95RZ1M"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let lecturers = [], courses = [], students = [], lecturerAttendanceRecords = [], attendanceChartInstance = null;
window.getChartInstance = () => attendanceChartInstance;

const hash = window.location.hash.replace('#', '');
const initialView = document.getElementById(hash) ? hash : 'dashboard';

setupNavigation();
navigateTo(initialView, false);
history.replaceState({ view: initialView }, '', '#' + initialView);

initChart();
setupFilters();
setupFormHandlers();
initPWA();

function initPWA() {
    let deferredPrompt;
    const installButtons = document.querySelectorAll('.pwa-install-btn');

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installButtons.forEach(btn => btn.classList.remove('hidden'));
    });

    installButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            installButtons.forEach(b => b.classList.add('hidden'));
            if (deferredPrompt) {
                deferredPrompt.prompt();
                deferredPrompt = null;
            }
        });
    });

    window.addEventListener('appinstalled', () => installButtons.forEach(btn => btn.classList.add('hidden')));

    if ('serviceWorker' in navigator) {
        let isRefreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!isRefreshing) { isRefreshing = true; window.location.reload(); }
        });

        window.addEventListener('load', async () => {
            try {
                const registration = await navigator.serviceWorker.register('./sw.js');
                registration.update();
                document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') registration.update(); });
                setInterval(() => registration.update(), 30 * 60 * 1000);
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (!newWorker) return;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            newWorker.postMessage({ type: 'SKIP_WAITING' });
                        }
                    });
                });
            } catch (err) { console.error('SW error:', err); }
        });
    }
}

// --- Real-Time Listeners ---
onSnapshot(collection(db, "lecturers"), (snapshot) => {
    lecturers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderLecturers();
    populateLecturerDropdown();
});
onSnapshot(collection(db, "courses"), (snapshot) => {
    courses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderCourses();
});
onSnapshot(collection(db, "student_attendance"), (snapshot) => {
    students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderAttendance();
    updateDashboardStats();
});
onSnapshot(collection(db, "lecturer_attendance"), (snapshot) => {
    lecturerAttendanceRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderLecturerAttendance();
    updateDashboardStats();
});

// --- Navigation ---
function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(link.getAttribute('data-target'), true);
        });
    });
    window.addEventListener('popstate', (e) => {
        const targetId = e.state && e.state.view ? e.state.view : (window.location.hash.replace('#', '') || 'dashboard');
        navigateTo(targetId, false);
    });
}

function navigateTo(targetId, updateHistory = true) {
    const targetView = document.getElementById(targetId);
    if (!targetView) return;
    if (updateHistory) history.pushState({ view: targetId }, '', '#' + targetId);

    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.remove('bg-blue-800', 'text-yellow-400', 'active');
        l.classList.add('text-white');
        if (l.getAttribute('data-target') === targetId) l.classList.add('bg-blue-800', 'text-yellow-400', 'active');
    });

    document.querySelectorAll('.view-section').forEach(view => {
        view.classList.remove('active');
        if (view.id === targetId) view.classList.add('active');
    });

    if(window.innerWidth < 1024 && !document.getElementById('sidebar').classList.contains('-translate-x-full')) {
        window.toggleSidebar(); 
    }
}

// --- Filters & Queries ---
function setupFilters() {
    const today = new Date().toISOString().split('T')[0];
    ['attendance-start-date', 'attendance-end-date', 'lecturer-start-date', 'lecturer-end-date', 'dashboard-master-date'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = today;
    });

    document.getElementById('attendance-start-date')?.addEventListener('change', renderAttendance);
    document.getElementById('attendance-end-date')?.addEventListener('change', renderAttendance);
    document.getElementById('attendance-search')?.addEventListener('input', renderAttendance);
    document.getElementById('lecturer-start-date')?.addEventListener('change', renderLecturerAttendance);
    document.getElementById('lecturer-end-date')?.addEventListener('change', renderLecturerAttendance);
    document.getElementById('dashboard-master-date')?.addEventListener('change', updateDashboardStats);
}

function getFilteredStudents() {
    const start = document.getElementById('attendance-start-date')?.value || '';
    const end = document.getElementById('attendance-end-date')?.value || '';
    const search = document.getElementById('attendance-search')?.value.toUpperCase().trim() || '';

    return students.filter(s => {
        return (start ? s.date >= start : true) && (end ? s.date <= end : true) && (search ? s.courseCode.toUpperCase().includes(search) : true);
    });
}

function getFilteredLecturerRecords() {
    const start = document.getElementById('lecturer-start-date')?.value || '';
    const end = document.getElementById('lecturer-end-date')?.value || '';
    return lecturerAttendanceRecords.filter(r => (start ? r.date >= start : true) && (end ? r.date <= end : true));
}

// --- Dashboard Stats & Chart ---
function updateDashboardStats() {
    const dateStr = document.getElementById('dashboard-master-date')?.value || '';
    const uniqueStudents = new Set(students.filter(s => s.date === dateStr).map(s => s.studentId)).size;
    if(document.getElementById('stat-students')) document.getElementById('stat-students').innerText = uniqueStudents;
    document.getElementById('stat-courses').innerText = courses.length;
    document.getElementById('stat-lecturers').innerText = lecturers.length;
    
    const presentStudents = students.filter(s => s.date === dateStr && s.status === 'present').length;
    if(document.getElementById('stat-daily-present')) document.getElementById('stat-daily-present').innerText = presentStudents;

    const presentLecturers = new Set(lecturerAttendanceRecords.filter(r => r.date === dateStr && r.status === 'present').map(r => r.lecturerId)).size;
    if(document.getElementById('stat-lecturer-daily-present')) document.getElementById('stat-lecturer-daily-present').innerText = presentLecturers;

    updateChartDynamically(dateStr);
}

function initChart() {
    const ctx = document.getElementById('attendanceChart').getContext('2d');
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#cbd5e1' : '#64748b';
    const legendColor = isDark ? '#f8fafc' : '#475569';

    attendanceChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [
                { label: 'Present', data: [], backgroundColor: '#10b981', borderRadius: 4 },
                { label: 'Late', data: [], backgroundColor: '#f59e0b', borderRadius: 4 },
                { label: 'Absent', data: [], backgroundColor: '#ef4444', borderRadius: 4 }
            ]
        },
        options: { 
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: legendColor } } },
            scales: { x: { stacked: true, ticks: { color: textColor } }, y: { stacked: true, beginAtZero: true, ticks: { color: textColor } } } 
        }
    });
}

function updateChartDynamically(selectedDateStr) {
    if (!attendanceChartInstance || !selectedDateStr) return;
    const dates = [], labels = [], presentCounts = [], lateCounts = [], absentCounts = [];
    const [year, month, day] = selectedDateStr.split('-').map(Number);
    
    for (let i = 4; i >= 0; i--) {
        const d = new Date(year, month - 1, day - i);
        const isoDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        dates.push(isoDate);
        labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
        
        const dayRecords = students.filter(s => s.date === isoDate);
        presentCounts.push(dayRecords.filter(s => s.status === 'present').length);
        lateCounts.push(dayRecords.filter(s => s.status === 'late').length);
        absentCounts.push(dayRecords.filter(s => s.status === 'absent').length);
    }
    attendanceChartInstance.data.labels = labels;
    attendanceChartInstance.data.datasets[0].data = presentCounts;
    attendanceChartInstance.data.datasets[1].data = lateCounts;
    attendanceChartInstance.data.datasets[2].data = absentCounts;
    attendanceChartInstance.update();
}

// --- Render Views ---
function renderCourses() {
    const tbody = document.getElementById('courses-tbody');
    tbody.innerHTML = '';
    courses.forEach(c => {
        const l = lecturers.find(x => x.id === c.lecturerId);
        const lName = l ? window.toTitleCase(l.name) : '<span class="text-red-500">Unassigned</span>';
        tbody.insertAdjacentHTML('beforeend', `<tr>
            <td class="px-6 py-4 font-medium">${c.code.toUpperCase()}</td>
            <td class="px-6 py-4">${window.toTitleCase(c.name)}</td>
            <td class="px-6 py-4"><i class="fa-solid fa-user text-slate-400 text-xs mr-2"></i>${lName}</td>
            <td class="px-6 py-4 text-right">
                <button class="text-blue-600 hover:text-blue-800 mr-4" onclick="editCourse('${c.id}')"><i class="fa-solid fa-pen"></i></button>
                <button class="text-red-500 hover:text-red-700" onclick="deleteCourse('${c.id}')"><i class="fa-solid fa-trash"></i></button>
            </td></tr>`);
    });
    updateDashboardStats();
}

function renderLecturers() {
    const tbody = document.getElementById('lecturers-tbody');
    tbody.innerHTML = '';
    lecturers.forEach(l => {
        tbody.insertAdjacentHTML('beforeend', `<tr>
            <td class="px-6 py-4 flex items-center gap-3">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(window.toTitleCase(l.name))}&background=e2e8f0&color=475569" class="w-8 h-8 rounded-full">
                <span class="font-medium">${window.toTitleCase(l.name)}</span>
            </td>
            <td class="px-6 py-4">${l.email}</td>
            <td class="px-6 py-4 text-right">
                <button class="text-blue-600 hover:text-blue-800 mr-4" onclick="editLecturer('${l.id}')"><i class="fa-solid fa-pen"></i></button>
                <button class="text-red-500 hover:text-red-700" onclick="deleteLecturer('${l.id}')"><i class="fa-solid fa-trash"></i></button>
            </td></tr>`);
    });
    updateDashboardStats();
    populateLecturerDropdown();
}

function renderAttendance() {
    const tbody = document.getElementById('attendance-tbody');
    const filtered = getFilteredStudents();
    tbody.innerHTML = '';
    
    if (filtered.length === 0) return tbody.innerHTML = `<tr><td colspan="11" class="px-6 py-8 text-center text-slate-500 bg-white"><i class="fa-regular fa-calendar-xmark text-3xl mb-3 text-slate-300 block"></i> No records found.</td></tr>`;

    filtered.forEach(s => {
        tbody.insertAdjacentHTML('beforeend', `<tr>
            <td class="px-6 py-4 font-medium">${s.studentId}</td>
            <td class="px-6 py-4">${window.toTitleCase(s.name)}</td>
            <td class="px-6 py-4">${s.level}</td>
            <td class="px-6 py-4 font-medium">${s.courseCode.toUpperCase()}</td>
            <td class="px-6 py-4">${window.toTitleCase(s.courseName)}</td>
            <td class="px-6 py-4 font-medium">${s.hall || '-'}</td>
            <td class="px-6 py-4 font-medium">${s.stream || '-'}</td>
            <td class="px-6 py-4">${s.date}</td>
            <td class="px-6 py-4">${s.time}</td>
            <td class="px-6 py-4 font-mono text-xs">${window.getGpsLink(s.gps)}</td>
            <td class="px-6 py-4 text-center">${window.getStatusBadge(s.status)}</td>
        </tr>`);
    });
}

function renderLecturerAttendance() {
    const tbody = document.getElementById('lecturer-attendance-tbody');
    const filtered = getFilteredLecturerRecords();
    tbody.innerHTML = '';
    
    if (filtered.length === 0) return tbody.innerHTML = `<tr><td colspan="8" class="px-6 py-8 text-center text-slate-500 bg-white"><i class="fa-regular fa-calendar-xmark text-3xl mb-3 text-slate-300 block"></i> No records found.</td></tr>`;

    filtered.forEach(r => {
        tbody.insertAdjacentHTML('beforeend', `<tr>
            <td class="px-6 py-4 flex items-center gap-3">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(window.toTitleCase(r.name))}&background=e2e8f0&color=475569" class="w-8 h-8 rounded-full">
                <span class="font-medium">${window.toTitleCase(r.name)}</span>
            </td>
            <td class="px-6 py-4 font-medium">${r.courseCode.toUpperCase()}</td>
            <td class="px-6 py-4">${window.toTitleCase(r.courseName)}</td>
            <td class="px-6 py-4 font-medium">${r.hall || '-'}</td>
            <td class="px-6 py-4">${r.date}</td>
            <td class="px-6 py-4">${r.time}</td>
            <td class="px-6 py-4 font-mono text-xs">${window.getGpsLink(r.gps)}</td>
            <td class="px-6 py-4 text-center">${window.getStatusBadge(r.status)}</td>
        </tr>`);
    });
}

// --- Modals & Data Mutations ---
function populateLecturerDropdown() {
    const sel = document.getElementById('course-lecturer');
    sel.innerHTML = '<option value="" disabled selected>Select a Lecturer</option>';
    lecturers.forEach(l => sel.innerHTML += `<option value="${l.id}">${window.toTitleCase(l.name)}</option>`);
}

function setupFormHandlers() {
    document.getElementById('course-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('course-id').value;
        const code = document.getElementById('course-code').value.toUpperCase();
        const name = document.getElementById('course-name').value;
        const lecturerId = document.getElementById('course-lecturer').value;

        if(!lecturerId) return window.showMessage("Please assign a lecturer.", "error");
        try {
            id ? await updateDoc(doc(db, "courses", id), { code, name, lecturerId }) : await addDoc(collection(db, "courses"), { code, name, lecturerId });
            window.showMessage(id ? "Course updated." : "Course added.");
            window.closeModal('course-modal');
        } catch (e) { window.showMessage("Error: " + e.message, "error"); }
    });

    document.getElementById('lecturer-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('lecturer-id').value;
        const inputName = document.getElementById('lecturer-name').value.trim();
        const inputEmail = document.getElementById('lecturer-email').value.trim();
        
        // --- Prevent Duplication Logic ---
        const isDuplicate = lecturers.some(l => 
            l.name.toLowerCase() === inputName.toLowerCase() && l.id !== id
        );

        if (isDuplicate) {
            return window.showMessage("A lecturer with this name already exists.", "error");
        }

        const data = { name: inputName, email: inputEmail };
        try {
            id ? await updateDoc(doc(db, "lecturers", id), data) : await addDoc(collection(db, "lecturers"), data);
            window.showMessage(id ? "Lecturer updated." : "Lecturer added.");
            window.closeModal('lecturer-modal');
        } catch (e) { window.showMessage("Error: " + e.message, "error"); }
    });
}

window.editCourse = (id) => {
    const c = courses.find(x => x.id === id);
    if(c) {
        document.getElementById('course-id').value = c.id; document.getElementById('course-code').value = c.code;
        document.getElementById('course-name').value = window.toTitleCase(c.name); document.getElementById('course-lecturer').value = c.lecturerId;
        document.getElementById('course-modal-title').innerText = 'Edit Course'; window.openModal('course-modal');
    }
};

window.deleteCourse = async (id) => {
    try { await deleteDoc(doc(db, "courses", id)); window.showMessage("Course deleted."); } catch (e) { window.showMessage("Error: " + e.message, "error"); }
};

window.editLecturer = (id) => {
    const l = lecturers.find(x => x.id === id);
    if(l) {
        document.getElementById('lecturer-id').value = l.id; document.getElementById('lecturer-name').value = window.toTitleCase(l.name);
        document.getElementById('lecturer-email').value = l.email; 
        document.getElementById('lecturer-modal-title').innerText = 'Edit Lecturer'; window.openModal('lecturer-modal');
    }
};

window.deleteLecturer = async (id) => {
    if(courses.some(c => c.lecturerId === id)) return window.showMessage("Cannot delete: Assigned to active courses.", "error");
    try { await deleteDoc(doc(db, "lecturers", id)); window.showMessage("Lecturer deleted."); } catch (e) { window.showMessage("Error: " + e.message, "error"); }
};

// --- Exports ---
window.downloadAttendanceCSV = () => {
    const filtered = getFilteredStudents();
    if (filtered.length === 0) return window.showMessage("No records to download.");
    
    const headers = ['Student ID', 'Student Name', 'Level', 'Course Code', 'Course Name', 'Hall', 'Stream', 'Status', 'Date', 'Time', 'GPS Coordinates'];
    const rows = filtered.map(s => [
        s.studentId, 
        `"${window.toTitleCase(s.name)}"`, 
        s.level, 
        s.courseCode.toUpperCase(), 
        `"${window.toTitleCase(s.courseName)}"`, 
        s.hall || '-', 
        s.stream || '-', 
        s.status.toUpperCase(), 
        s.date, 
        s.time, 
        `"${s.gps}"`
    ].join(','));
    
    triggerDownload([headers.join(','), ...rows].join('\n'), `student_attendance.csv`);
};

window.downloadLecturerAttendanceCSV = () => {
    const filtered = getFilteredLecturerRecords();
    if (filtered.length === 0) return window.showMessage("No records to download.");
    
    const headers = ['Lecturer Name', 'Course Code', 'Course Name', 'Hall', 'Date', 'Time', 'GPS Coordinates', 'Status'];
    const rows = filtered.map(r => [
        `"${window.toTitleCase(r.name)}"`, 
        r.courseCode.toUpperCase(), 
        `"${window.toTitleCase(r.courseName)}"`, 
        r.hall || '-', 
        r.date, 
        r.time, 
        `"${r.gps}"`, 
        r.status.toUpperCase()
    ].join(','));
    
    triggerDownload([headers.join(','), ...rows].join('\n'), `lecturer_attendance.csv`);
};

function triggerDownload(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.showMessage("Download started.");
}
