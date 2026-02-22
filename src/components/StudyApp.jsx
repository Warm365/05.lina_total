import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, doc, onSnapshot, query, orderBy, setDoc, addDoc, serverTimestamp, deleteDoc, getDoc } from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';

const appId = 'taerin-app';
const ICONS = ['🐰', '📚', '✨', '✏️', '🚀', '🌱', '💡', '🎉', '🎨', '🎵'];
const REWARDS_CONFIG = [
    { rank: 1, name: "뽑기 1천원 추가 💰", minProb: 5, maxProb: 50 },
    { rank: 2, name: "알리선물 1천원 🎁", minProb: 10, maxProb: 40 },
    { rank: 3, name: "티비 10분 보기 📺", minProb: 20, maxProb: 5 },
    { rank: 4, name: "엄마와 10분 놀기 👨‍👧", minProb: 30, maxProb: 3 },
    { rank: 5, name: "아빠와 10분 놀기 👨‍👧", minProb: 35, maxProb: 2 }
];

const INITIAL_COUPONS = [
    { id: 1, name: '뽑기 1천원 추가', count: 0, icon: '💰', borderColor: 'border-yellow-200' },
    { id: 2, name: '알리선물 1천원', count: 0, icon: '🎁', borderColor: 'border-pink-200' },
    { id: 3, name: '티비 10분 보기', count: 0, icon: '📺', borderColor: 'border-blue-200' },
    { id: 4, name: '엄마와 10분 놀기', count: 0, icon: '👩‍❤️‍👩', borderColor: 'border-purple-200' },
    { id: 5, name: '아빠와 10분 놀기', count: 0, icon: '👨‍❤️‍👨', borderColor: 'border-indigo-200' },
];

const SANRIO_IMAGES = [
    '/images/cinnamoroll-1.png',
    '/images/kuromi-1.png',
    '/images/pochacco-1.png'
];

function getFormattedDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function isToday(date) {
    const today = new Date();
    return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
}

const StudyApp = () => {
    // Auth State
    const [isConnected, setIsConnected] = useState(false);

    // Core State
    const [currentDate, setCurrentDate] = useState(new Date());
    const [currentTimeText, setCurrentTimeText] = useState('');
    const [currentTasks, setCurrentTasks] = useState(["눈높이수학", "눈높이국어", "기탄수학", "큐브연산", "용선생", "한자", "냅킨", "캔비(숙제)", "캔비(알렉스)", "학교숙제"]);
    const [historyData, setHistoryData] = useState({});
    const [cheers, setCheers] = useState([]);
    const [profileImages, setProfileImages] = useState([]);

    // Self-Study C-3 State
    const [selfStudyRunning, setSelfStudyRunning] = useState(false);
    const [selfStudyStartTime, setSelfStudyStartTime] = useState(null);
    const [selfStudyElapsedMsg, setSelfStudyElapsedMsg] = useState('');
    const [showSlotModal, setShowSlotModal] = useState(false);
    const [slots, setSlots] = useState([0, 1, 2]);
    const [isSpinning, setIsSpinning] = useState(false);
    const [slotResult, setSlotResult] = useState(null);

    // Inputs
    const [cheerName, setCheerName] = useState('');
    const [cheerMsg, setCheerMsg] = useState('');
    const [editTaskText, setEditTaskText] = useState('');

    // Modals
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showRewardModal, setShowRewardModal] = useState(false);
    const [showRewardInfoModal, setShowRewardInfoModal] = useState(false);
    const [calendarMonth, setCalendarMonth] = useState(new Date());
    const [rewardResult, setRewardResult] = useState(null);

    // Sync state for local self-study
    useEffect(() => {
        const localStart = localStorage.getItem('selfStudyStart');
        if (localStart) {
            setSelfStudyStartTime(parseInt(localStart, 10));
            setSelfStudyRunning(true);
        }
    }, []);

    // Initial Auth & Listeners
    useEffect(() => {
        const initAuth = async () => {
            try { await signInAnonymously(auth); } catch (error) { console.error("Auth error", error); }
        };
        initAuth();

        let unsubConfig, unsubCheers, unsubHistory;
        const authUnsub = onAuthStateChanged(auth, (user) => {
            setIsConnected(!!user);
            if (user) {
                // Config Listener
                const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'study_config', 'main');
                unsubConfig = onSnapshot(configRef, (docSnap) => {
                    if (docSnap.exists() && docSnap.data().tasks) {
                        setCurrentTasks(docSnap.data().tasks);
                    } else {
                        setDoc(configRef, { tasks: currentTasks }, { merge: true });
                    }
                });

                // Cheers Listener
                const cheerRef = collection(db, 'artifacts', appId, 'public', 'data', 'cheers');
                unsubCheers = onSnapshot(query(cheerRef, orderBy("timestamp", "desc")), (snapshot) => {
                    setCheers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
                });

                // History Listener
                const historyColRef = collection(db, 'artifacts', appId, 'public', 'data', 'study_history');
                unsubHistory = onSnapshot(historyColRef, (snapshot) => {
                    const newHistory = {};
                    snapshot.forEach(d => {
                        newHistory[d.id] = d.data();
                        if (d.data().reward) localStorage.setItem(`reward-${d.id}`, d.data().reward);
                    });
                    setHistoryData(newHistory);
                });
            }
        });

        // Load Local Profiles
        try {
            const stored = localStorage.getItem('taerinProfileImages');
            if (stored) setProfileImages(JSON.parse(stored));
        } catch { /* ignore */ }

        // Clock & Self-study Timer interval
        const clockTimer = setInterval(() => {
            setCurrentTimeText(new Date().toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));

            if (selfStudyRunning) {
                const start = parseInt(localStorage.getItem('selfStudyStart'), 10);
                if (start) {
                    const diff = Date.now() - start;
                    const m = Math.floor(diff / 60000);
                    const s = Math.floor((diff % 60000) / 1000);
                    setSelfStudyElapsedMsg(`${m}분 ${s}초 경과 🌱`);
                }
            }
        }, 1000);

        return () => {
            authUnsub();
            if (unsubConfig) unsubConfig();
            if (unsubCheers) unsubCheers();
            if (unsubHistory) unsubHistory();
            clearInterval(clockTimer);
        };
    }, [selfStudyRunning]);

    const dateStr = getFormattedDate(currentDate);
    const todayStr = getFormattedDate(new Date());

    // Current Day Data
    const dayData = historyData[dateStr] || { tasks: [] };
    const defaultList = Array.from({ length: currentTasks.length }, () => ({ startTime: null, endTime: null }));
    const statusList = (dayData.tasks && dayData.tasks.length > 0) ? dayData.tasks : defaultList;

    const displayCount = Math.max(currentTasks.length, statusList.length);
    const completedCount = statusList.filter(t => t.endTime).length;
    const progressPct = displayCount > 0 ? (completedCount / displayCount) * 100 : 0;

    let totalTime = 0;
    statusList.forEach(t => { if (t.endTime && t.startTime) totalTime += (t.endTime - t.startTime); });
    const totalMinutes = Math.floor(totalTime / 60000);

    const savedReward = dayData.reward || localStorage.getItem(`reward-${dateStr}`);
    const isAllDoneAndToday = completedCount === displayCount && displayCount > 0 && isToday(currentDate);

    // Profile Image Logic
    const profileIdx = todayStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % (profileImages.length || 1);
    const currentProfileImg = profileImages.length > 0 ? profileImages[profileIdx] : null;

    // --- Actions ---
    const showToast = (msg) => {
        const el = document.getElementById('toast-container');
        if (el) { el.textContent = msg; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 3000); }
    };

    // --- Self Study C-3 Logic ---
    const handleStartSelfStudy = () => {
        const now = Date.now();
        setSelfStudyStartTime(now);
        setSelfStudyRunning(true);
        localStorage.setItem('selfStudyStart', now.toString());
        showToast("🌱 스스로 공부를 시작했어요! 집중해볼까요?");
    };

    const handleHarvestSelfStudy = () => {
        if (!selfStudyStartTime) return;
        const elapsedMin = (Date.now() - selfStudyStartTime) / 60000;

        // Checklist >= 4 AND Time >= 30 mins
        // FOR TESTING: Bypassing time limit if needed, normally (elapsedMin >= 30)
        let isDevTest = false;
        if (completedCount < 4) {
            if (!window.confirm(`앗! 아직 체크리스트를 4개 이상 달성하지 못했어요. (현재 ${completedCount}개 달성)\n\n테스트를 위해 강제 종료하시겠습니까?`)) return;
            isDevTest = true;
        }
        if (elapsedMin < 30 && !isDevTest) {
            if (!window.confirm(`아직 30분이 안 지났어요! (현재 ${elapsedMin.toFixed(1)}분)\n\n테스트를 위해 강제 종료하시겠습니까?`)) return;
        }

        setShowSlotModal(true);
        runSlotMachine();
    };

    const saveToMoneyApp = async (amount, desc) => {
        try {
            const txRef = collection(db, 'artifacts', appId, 'public', 'data', 'money_transactions');
            await addDoc(txRef, {
                type: 'income',
                amount: amount,
                description: desc,
                date: new Date().toLocaleDateString(),
                timestamp: serverTimestamp()
            });
            showToast(`👛 용돈 지갑에 ${amount}원이 자동으로 쏙! 들어갔어요!`);
        } catch (error) { console.error("Money sync failed", error); }
    };

    const runSlotMachine = () => {
        setIsSpinning(true);
        setSlotResult(null);
        let count = 0;
        const interval = setInterval(() => {
            setSlots([
                Math.floor(Math.random() * 3),
                Math.floor(Math.random() * 3),
                Math.floor(Math.random() * 3)
            ]);
            count++;
            // Spin for ~2 seconds
            if (count > 20) {
                clearInterval(interval);
                finalizeSlotMachine();
            }
        }, 100);
    };

    const finalizeSlotMachine = () => {
        const finalSlots = [
            Math.floor(Math.random() * 3),
            Math.floor(Math.random() * 3),
            Math.floor(Math.random() * 3)
        ];
        setSlots(finalSlots);
        setIsSpinning(false);

        let matchCount = 1;
        if (finalSlots[0] === finalSlots[1] && finalSlots[1] === finalSlots[2]) {
            matchCount = 3;
        } else if (finalSlots[0] === finalSlots[1] || finalSlots[1] === finalSlots[2] || finalSlots[0] === finalSlots[2]) {
            matchCount = 2;
        }

        let amount = 100;
        if (matchCount === 3) amount = 1000;
        else if (matchCount === 2) amount = 500;

        setSlotResult({ matchCount, amount });
        localStorage.removeItem('selfStudyStart');
        setSelfStudyRunning(false);

        // Auto Sync
        saveToMoneyApp(amount, `🎉 스스로 공부 완료! (캐릭터 ${matchCount}개 일치)`);
    };

    const handleToggleTimer = async (index) => {
        if (!auth.currentUser) return showToast("DB 연결 중입니다...");
        const newList = [...statusList];
        while (newList.length <= index) newList.push({ startTime: null, endTime: null });

        let task = newList[index];
        const now = Date.now();
        if (!task.startTime) task.startTime = now;
        else task.endTime = now;

        try {
            const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'study_history', dateStr);
            await setDoc(docRef, { tasks: newList, lastUpdate: serverTimestamp() }, { merge: true });
        } catch { showToast("저장 실패: 권한 확인 필요"); }
    };

    const handleAddCheer = async () => {
        if (!auth.currentUser) return showToast("로그인 중입니다. 잠시만 기다려주세요.");
        if (!cheerName.trim() || !cheerMsg.trim()) return showToast("이름과 메시지를 모두 입력해주세요.");
        try {
            const cheerRef = collection(db, 'artifacts', appId, 'public', 'data', 'cheers');
            await addDoc(cheerRef, { name: cheerName.trim(), message: cheerMsg.trim(), date: getFormattedDate(new Date()), timestamp: serverTimestamp() });
            setCheerName(''); setCheerMsg('');
            showToast("응원 메시지가 등록되었습니다! 🎉");
        } catch { showToast("저장 실패: 권한이 필요합니다."); }
    };

    const handleDeleteCheer = async (id) => {
        if (window.confirm("정말 삭제할까요?")) {
            try {
                const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'cheers', id);
                await deleteDoc(docRef);
                showToast("삭제되었습니다.");
            } catch { showToast("삭제 실패: 권한이 필요합니다."); }
        }
    };

    const handleResetToday = async () => {
        if (!isToday(currentDate)) return showToast("오늘만 초기화 가능해요.");
        if (window.confirm("정말 초기화할까요?")) {
            const empty = Array.from({ length: currentTasks.length }, () => ({ startTime: null, endTime: null }));
            try {
                const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'study_history', dateStr);
                await setDoc(docRef, { tasks: empty, lastUpdate: serverTimestamp() }, { merge: true });
                showToast("초기화되었습니다.");
            } catch { showToast("초기화 실패"); }
        }
    };

    const handleSyncData = async () => {
        if (!window.confirm("기기에 저장된 과거 학습 기록을 클라우드로 업로드할까요?\n(기존 클라우드 데이터는 유지됩니다)")) return;
        let count = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('history-')) {
                const dateStr = key.replace('history-', '');
                try {
                    const tasks = JSON.parse(localStorage.getItem(key));
                    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'study_history', dateStr);
                    await setDoc(docRef, { tasks: tasks }, { merge: true });
                    count++;
                } catch { /* ignore */ }
            }
            if (key.startsWith('reward-')) {
                const dateStr = key.replace('reward-', '');
                const reward = localStorage.getItem(key);
                const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'study_history', dateStr);
                await setDoc(docRef, { reward: reward }, { merge: true });
            }
        }
        showToast(`${count}일치의 데이터를 동기화했습니다!`);
    };

    const handleSaveEditTasks = async () => {
        const newTasks = editTaskText.split('\n').map(t => t.trim()).filter(t => t);
        if (newTasks.length === 0) return alert("하나 이상 입력해주세요.");
        try {
            const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'study_config', 'main');
            await setDoc(configRef, { tasks: newTasks }, { merge: true });
            setShowEditModal(false);
            showToast("학습 목록이 클라우드에 저장되었습니다.");
        } catch { alert("저장 실패. 인터넷 연결을 확인해주세요."); }
    };

    const handleDeleteProfileImage = (index) => {
        if (window.confirm("삭제할까요?")) {
            const newImgs = [...profileImages];
            newImgs.splice(index, 1);
            setProfileImages(newImgs);
            localStorage.setItem('taerinProfileImages', JSON.stringify(newImgs));
        }
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const img = new Image();
            img.onload = () => {
                const cvs = document.createElement('canvas');
                const ctx = cvs.getContext('2d');
                const MAX = 300;
                let w = img.width, h = img.height;
                if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } } else { if (h > MAX) { w *= MAX / h; h = MAX; } }
                cvs.width = w; cvs.height = h;
                ctx.drawImage(img, 0, 0, w, h);
                const data = cvs.toDataURL('image/jpeg', 0.8);
                const newImgs = [...profileImages, data];
                setProfileImages(newImgs);
                localStorage.setItem('taerinProfileImages', JSON.stringify(newImgs));
            }
            img.src = evt.target.result;
        };
        reader.readAsDataURL(file);
    };

    // Auto sync coupons on draw reward
    const handleDrawReward = async () => {
        const clampedMinutes = Math.max(0, Math.min(totalMinutes, 100));
        const ratio = clampedMinutes / 100;
        let probs = REWARDS_CONFIG.map(r => ({ ...r, currentProb: r.minProb + (r.maxProb - r.minProb) * ratio }));
        const tProb = probs.reduce((sum, item) => sum + item.currentProb, 0);
        probs = probs.map(item => ({ ...item, currentProb: (item.currentProb / tProb) * 100 }));

        const rand = Math.random() * 100;
        let cumulative = 0;
        let pick = probs[probs.length - 1];
        for (const item of probs) {
            cumulative += item.currentProb;
            if (rand <= cumulative) { pick = item; break; }
        }

        setRewardResult(pick);
        localStorage.setItem(`reward-${dateStr}`, pick.name);
        try {
            // Save to study_history
            const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'study_history', dateStr);
            await setDoc(docRef, { reward: pick.name }, { merge: true });

            // Auto-Sync to Coupon Inventory (MoneyApp)
            const couponRef = doc(db, 'artifacts', appId, 'public', 'data', 'money_data', 'coupons');
            const docSnap = await getDoc(couponRef);
            let coupons = [];
            if (docSnap.exists()) {
                coupons = docSnap.data().list;
            } else {
                coupons = INITIAL_COUPONS;
            }

            // match coupon by rank
            const newCoupons = coupons.map(c => c.id === pick.rank ? { ...c, count: c.count + 1 } : c);
            await setDoc(couponRef, { list: newCoupons });

            const matchedCoupon = newCoupons.find(c => c.id === pick.rank);
            if (matchedCoupon) {
                const chRef = collection(db, 'artifacts', appId, 'public', 'data', 'coupon_history');
                await addDoc(chRef, {
                    couponId: matchedCoupon.id,
                    couponName: matchedCoupon.name,
                    icon: matchedCoupon.icon,
                    type: 'get',
                    date: new Date().toLocaleDateString(),
                    timestamp: serverTimestamp()
                });
                showToast(`🎟️ 보물함(용돈관리)에 쿠폰이 자동으로 쏙! 들어갔어요!`);
            }
        } catch (error) { console.error("Reward sync to money app failed", error); }
    };

    // Calendar Helpers
    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
    function renderCalendarGrid() {
        const year = calendarMonth.getFullYear();
        const month = calendarMonth.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        const days = [];
        for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`}></div>);
        for (let d = 1; d <= daysInMonth; d++) {
            const dStr = getFormattedDate(new Date(year, month, d));
            const hData = historyData[dStr];
            const sReward = hData?.reward || localStorage.getItem(`reward-${dStr}`);
            let dailyMinutes = 0;
            let elClass = "cal-day";

            if (hData && hData.tasks) {
                const comp = hData.tasks.filter(t => t.endTime).length;
                hData.tasks.forEach(t => { if (t.startTime && t.endTime) dailyMinutes += (t.endTime - t.startTime); });
                if (comp > 0) {
                    if (comp === hData.tasks.length && hData.tasks.length > 0) elClass += " bg-green-light";
                    else elClass += " bg-yellow-light";
                }
            }
            days.push(
                <div key={d} className={elClass} onClick={() => { setCurrentDate(new Date(year, month, d)); setShowHistoryModal(false); }}>
                    <div>{d}</div>
                    {dailyMinutes > 0 && <div style={{ fontSize: '0.7rem', color: '#4b5563', fontWeight: 500 }}>{Math.floor(dailyMinutes / 60000)}분</div>}
                    {sReward && <div style={{ fontSize: '0.6rem' }}>🎁</div>}
                </div>
            );
        }
        return days;
    }

    return (
        <div id="study-app-wrapper" className="section-container active">
            <div className="app-container">
                <div className={`header-auth-badge ${isConnected ? 'connected' : ''}`}>
                    <div className="auth-dot"></div>
                    <span id="header-auth-text">{isConnected ? '클라우드 연결됨' : '연결 대기중...'}</span>
                </div>

                <div className="clock">{currentTimeText}</div>

                <header>
                    {currentProfileImg ? (
                        <div className="profile-img-container">
                            <img src={currentProfileImg} alt="Profile" className="profile-img" />
                            <div className="today-badge">오늘의 그림</div>
                        </div>
                    ) : (
                        <div className="profile-img-container">
                            <span className="profile-placeholder">🐰</span>
                        </div>
                    )}
                    <h1 id="main-title">{dateStr === todayStr ? '태린이의 오늘 공부 🚀' : `${currentDate.getMonth() + 1}월 ${currentDate.getDate()}일의 공부`}</h1>
                    <p className="subtitle">오늘의 목표를 달성해 보세요!</p>
                </header>

                {/* C-3: "요정의 마법 화분" 스스로 선언 파트 */}
                {dateStr === todayStr && (
                    <div className="mb-6 bg-gradient-to-r from-emerald-50 to-teal-50 p-5 rounded-2xl border-2 border-emerald-100 shadow-sm text-center">
                        {!selfStudyRunning ? (
                            <>
                                <h3 className="text-lg font-cute font-bold text-emerald-800 mb-2">스스로 공부하기 🌱</h3>
                                <p className="text-sm text-emerald-600 mb-4 font-medium">스스로 공부를 시작하고 4개 이상 마치면 슬롯머신이 등장해요!</p>
                                <button className="btn w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl shadow-md text-lg transition-transform active:scale-95" onClick={handleStartSelfStudy}>
                                    🌱 오늘 스스로 공부시작 하기
                                </button>
                            </>
                        ) : (
                            <>
                                <h3 className="text-lg font-cute font-bold text-teal-800 mb-2">스스로 공부하는 중... 💧</h3>
                                <p className="text-sm font-bold text-teal-600 mb-1">{selfStudyElapsedMsg}</p>
                                <p className="text-xs text-teal-500 mb-4">(체크리스트 4개 달성 + 최소 30분 경과 시 종료 가능)</p>
                                <button className="btn w-full bg-teal-500 hover:bg-teal-600 text-white py-3 rounded-xl shadow-md text-lg transition-transform active:scale-95 animate-pulse" onClick={handleHarvestSelfStudy}>
                                    ✨ 오늘 스스로 공부종료 하기
                                </button>
                            </>
                        )}
                    </div>
                )}

                <div className="progress-section">
                    <div className="progress-info">
                        <span>진행률</span>
                        <span>{completedCount} / {displayCount}</span>
                    </div>
                    <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${progressPct}%` }}></div>
                    </div>
                    <div className="total-time">오늘 총 공부 시간: {totalMinutes}분</div>
                </div>

                <div className="task-grid">
                    {Array.from({ length: displayCount }).map((_, i) => {
                        const taskText = currentTasks[i] || `과거 학습 ${i + 1}`;
                        const taskStatus = statusList[i] || { startTime: null, endTime: null };
                        const icon = ICONS[i % ICONS.length];

                        let durationText = '대기 중';
                        let btnText = '시작';
                        let btnClass = 'btn-blue';
                        let isDisabled = false;
                        let itemClass = "task-item";

                        if (taskStatus.endTime) {
                            const duration = Math.floor((taskStatus.endTime - taskStatus.startTime) / 60000);
                            durationText = `공부 시간: ${duration}분`;
                            btnText = '완료'; btnClass = 'btn-gray'; isDisabled = true;
                            itemClass += " completed";
                        } else if (taskStatus.startTime) {
                            const st = new Date(taskStatus.startTime);
                            durationText = `시작: ${st.getHours()}:${String(st.getMinutes()).padStart(2, '0')}`;
                            btnText = '종료'; btnClass = 'btn-red';
                            itemClass += " in-progress";
                        }

                        return (
                            <div key={i} className={itemClass}>
                                <div className="task-content">
                                    <div className="task-text">{icon} {taskText}</div>
                                    <div className="task-status">{durationText}</div>
                                </div>
                                <button className={`btn ${btnClass} btn-timer`} disabled={isDisabled} onClick={() => handleToggleTimer(i)}>{btnText}</button>
                            </div>
                        );
                    })}
                </div>

                <div className="button-area mt-8">
                    <button className="btn btn-green btn-bottom mb-2 flex-1" onClick={() => { setCalendarMonth(new Date()); setShowHistoryModal(true); }}>학습 기록 보기</button>
                    {dateStr !== todayStr && <button className="btn btn-blue btn-bottom mb-2 flex-1 mx-2" onClick={() => setCurrentDate(new Date())}>오늘로 돌아가기</button>}
                    <button className="btn btn-indigo btn-bottom mb-2 flex-1 mx-2" onClick={() => { setEditTaskText(currentTasks.join('\n')); setShowEditModal(true); }}>학습 목록 수정</button>
                    <button className="btn btn-indigo btn-bottom mb-2 flex-1 mx-2" onClick={handleSyncData}>기기 동기화 ☁️</button>
                    <button className="btn btn-gray btn-bottom mb-2 flex-1 mx-2" onClick={handleResetToday}>오늘 기록 초기화</button>
                    <button className="btn btn-purple btn-bottom mb-2 flex-1 mx-2" onClick={() => setShowRewardInfoModal(true)}>보상 설명서</button>
                    {isAllDoneAndToday && (
                        savedReward ? (
                            <button className="btn btn-gray btn-bottom mb-2 flex-1 mx-2" disabled>오늘 타이머 보상 완료! 🎁</button>
                        ) : (
                            <button className="btn btn-yellow btn-bottom mb-2 flex-1 mx-2" onClick={() => { setRewardResult(null); setShowRewardModal(true); }}>타이머 보상 뽑기 🎁</button>
                        )
                    )}
                </div>

                <div className="cheer-section">
                    <div className="cheer-title">💌 태린이를 위한 응원 한마디</div>
                    <div className="cheer-input-group">
                        <input type="text" className="cheer-input cheer-name" placeholder="이름 (예: 아빠)" style={{ width: '100px' }} value={cheerName} onChange={e => setCheerName(e.target.value)} />
                        <input type="text" className="cheer-input cheer-msg" style={{ flexGrow: 1 }} placeholder="응원 메시지를 남겨주세요!" value={cheerMsg} onChange={e => setCheerMsg(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddCheer() }} />
                        <button className="btn btn-pink" style={{ flexShrink: 0 }} onClick={handleAddCheer}>등록</button>
                    </div>
                    <div className="cheer-list">
                        {cheers.length === 0 ? (
                            <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '1rem' }}>아직 등록된 응원 메시지가 없어요.<br />첫 번째 응원을 남겨보세요! 💌</div>
                        ) : (
                            cheers.map(msg => (
                                <div key={msg.id} className="cheer-item">
                                    <div className="cheer-content">
                                        <span className="cheer-writer">{msg.name} ({msg.date})</span>
                                        <span className="cheer-message-text">{msg.message}</span>
                                    </div>
                                    <button className="cheer-delete-btn" style={{ background: 'transparent', border: 'none', fontSize: '1.2rem' }} onClick={() => handleDeleteCheer(msg.id)}>&times;</button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Modals */}
            {/* Slot Machine Modal */}
            {showSlotModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl">
                        <h2 className="text-2xl font-cute text-pink-500 font-bold mb-4">🎰 산리오 슬롯머신!</h2>
                        <div className="flex justify-center gap-3 mb-6 bg-pink-50 p-4 rounded-2xl border border-pink-100">
                            {slots.map((sIdx, i) => (
                                <div key={i} className="w-20 h-20 bg-white rounded-xl shadow-inner border-2 border-pink-200 overflow-hidden flex items-center justify-center p-1">
                                    <img src={SANRIO_IMAGES[sIdx]} alt="sanrio" className={`w-full h-full object-contain ${isSpinning ? 'animate-pulse' : 'animate-bounce'}`} />
                                </div>
                            ))}
                        </div>

                        {!slotResult ? (
                            <button disabled={isSpinning} className="w-full py-4 text-white font-bold text-xl rounded-2xl shadow-lg bg-pink-500 hover:bg-pink-600 transition-all disabled:opacity-50" onClick={runSlotMachine}>
                                {isSpinning ? '돌아가는 중... 🌀' : '버튼 눌러 뽑기! ✨'}
                            </button>
                        ) : (
                            <div className="animate-fade-in mt-4">
                                <p className="text-gray-600 font-bold text-sm mb-1">{slotResult.matchCount}개 일치!</p>
                                <p className="text-3xl font-cute text-blue-600 mb-4">{slotResult.amount.toLocaleString()}원 당첨 🎉</p>
                                <button className="w-full py-4 text-white font-bold text-lg rounded-2xl shadow-lg bg-blue-500 hover:bg-blue-600 transition-all active:scale-95" onClick={() => setShowSlotModal(false)}>
                                    용돈 지갑에 넣기 💰
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showHistoryModal && (
                <div className="modal-backdrop">
                    <div className="modal-content" style={{ maxWidth: '32rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2 className="modal-title m-0">학습 기록 달력</h2>
                            <button style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }} onClick={() => setShowHistoryModal(false)}>&times;</button>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <button className="btn btn-gray btn-sm" style={{ width: '3rem' }} onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>&lt;</button>
                            <h3 style={{ fontWeight: 'bold', fontSize: '1.2rem', margin: 0 }}>{calendarMonth.getFullYear()}년 {calendarMonth.getMonth() + 1}월</h3>
                            <button className="btn btn-gray btn-sm" style={{ width: '3rem' }} onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>&gt;</button>
                        </div>
                        <div className="calendar-grid">
                            {['일', '월', '화', '수', '목', '금', '토'].map(d => <div key={d} style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.75rem', padding: '0.25rem 0' }}>{d}</div>)}
                            {renderCalendarGrid()}
                        </div>
                        <div className="reward-list">
                            <h4 style={{ fontWeight: 'bold', marginBottom: '0.5rem', marginTop: 0 }}>🎁 이번 달 받은 선물</h4>
                            <div>
                                {Array.from({ length: getDaysInMonth(calendarMonth.getFullYear(), calendarMonth.getMonth()) }).map((_, i) => {
                                    const d = i + 1;
                                    const dStr = getFormattedDate(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), d));
                                    const r = (historyData[dStr] && historyData[dStr].reward) || localStorage.getItem(`reward-${dStr}`);
                                    if (r) return <div key={d} className="reward-item"><span style={{ color: '#6b7280', fontSize: '0.8rem' }}>{calendarMonth.getMonth() + 1}/{d}</span><span>{r}</span></div>;
                                    return null;
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showEditModal && (
                <div className="modal-backdrop">
                    <div className="modal-content">
                        <h2 className="modal-title">학습 목록 수정</h2>
                        <textarea value={editTaskText} onChange={e => setEditTaskText(e.target.value)}></textarea>
                        <div style={{ marginTop: '1.5rem' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#4b5563' }}>프로필 이미지 (내 기기에만 저장됨)</h3>
                            <input type="file" accept="image/*" onChange={handleImageUpload} style={{ marginBottom: '0.5rem' }} />
                            <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: 0 }}>{profileImages.length} / 5</p>
                            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', padding: '0.5rem 0' }}>
                                {profileImages.map((src, i) => (
                                    <div key={i} style={{ position: 'relative', width: '60px', height: '60px', flexShrink: 0 }}>
                                        <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '0.5rem' }} />
                                        <button onClick={() => handleDeleteProfileImage(i)} style={{ position: 'absolute', top: '-5px', right: '-5px', background: 'red', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>X</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                            <button className="btn btn-gray" onClick={() => setShowEditModal(false)}>취소</button>
                            <button className="btn btn-blue" onClick={handleSaveEditTasks}>저장</button>
                        </div>
                    </div>
                </div>
            )}

            {showRewardModal && (
                <div className="modal-backdrop">
                    <div className="modal-content" style={{ textAlign: 'center' }}>
                        <h2 style={{ fontSize: '3rem', margin: 0, marginBottom: '1rem' }}>🥁</h2>
                        <h3 className="modal-title m-0 mb-4">{rewardResult ? '당첨 축하해요!' : '보상 추첨'}</h3>

                        {!rewardResult ? (
                            <>
                                <div className="prob-container" style={{ textAlign: 'left' }}>
                                    <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem', color: '#4b5563' }}>📢 현재 공부 시간: {totalMinutes}분</div>
                                    <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: 0 }}>공부 시간이 길수록 좋은 선물이 나와요!</p>
                                </div>
                                <div style={{ marginTop: '1.5rem' }}>
                                    <button className="btn btn-yellow" onClick={handleDrawReward} style={{ width: '100%', fontSize: '1.2rem', padding: '1rem 0' }}>도전! ✨</button>
                                </div>
                            </>
                        ) : (
                            <div>
                                <p style={{ margin: 0, marginBottom: '0.5rem', color: '#4b5563', fontWeight: 600 }}>{rewardResult.rank}등 당첨!</p>
                                <p style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--blue-600)', margin: 0, marginBottom: '1.5rem' }}>{rewardResult.name}</p>
                                <div><button className="btn btn-blue" onClick={() => setShowRewardModal(false)}>확인</button></div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showRewardInfoModal && (
                <div className="modal-backdrop">
                    <div className="modal-content">
                        <h2 className="modal-title">🎁 현재 당첨 확률</h2>
                        <div className="prob-container">
                            <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem', color: '#4b5563' }}>📢 현재 공부 시간: {totalMinutes}분</div>
                            {(() => {
                                const clampedMinutes = Math.max(0, Math.min(totalMinutes, 100));
                                const ratio = clampedMinutes / 100;
                                let probs = REWARDS_CONFIG.map(r => ({ ...r, currentProb: r.minProb + (r.maxProb - r.minProb) * ratio }));
                                const tProb = probs.reduce((sum, item) => sum + item.currentProb, 0);
                                probs = probs.map(item => ({ ...item, currentProb: (item.currentProb / tProb) * 100 }));

                                return probs.map(p => (
                                    <div key={p.rank} className="prob-row">
                                        <div className="prob-name" style={p.rank === 1 ? { fontWeight: 'bold', color: '#eab308' } : {}}>{p.rank}등: {p.name}</div>
                                        <div className="prob-bar-area"><div className={`prob-bar-fill bar-rank-${p.rank}`} style={{ width: `${p.currentProb}%` }}></div></div>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 600, width: '2.5rem', textAlign: 'right' }}>{p.currentProb.toFixed(0)}%</div>
                                    </div>
                                ));
                            })()}
                        </div>
                        <div style={{ textAlign: 'right', marginTop: '1rem' }}>
                            <button className="btn btn-gray" onClick={() => setShowRewardInfoModal(false)}>닫기</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudyApp;
