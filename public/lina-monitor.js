/**
 * 태린이 전용 어플 사용량 모니터링 SDK (v1.0)
 * 아빠(팀장님)의 Firebase lina-total 프로젝트와 연동됩니다.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, increment, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDPPlH3Cs9WsXZnDN1dcg0FMEWxicjInpM",
    authDomain: "lina-total.firebaseapp.com",
    projectId: "lina-total",
    storageBucket: "lina-total.firebasestorage.app",
    messagingSenderId: "517796044927",
    appId: "1:517796044927:web:a5255e985ffbeca74f1f4a",
    measurementId: "G-ERE3TMYJQ6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 현재 앱 이름 추출 (주소창 분석)
let appName = window.location.hostname.split('.')[0]; // Netlify 도메인 첫 파트 (예: lina-domino)

// 로컬 테스트 중이거나 도메인 감지가 안 될 경우 폴더명 사용
if (!appName || appName === 'localhost' || appName === '127') {
    const pathParts = window.location.pathname.split('/').filter(p => p && !p.includes('.html'));
    appName = pathParts.pop() || "lina-portal";
}

async function reportUsage() {
    if (document.visibilityState === 'visible') {
        const now = new Date();
        const kstOffset = 9 * 60 * 60 * 1000; // KST는 UTC+9
        const kstDate = new Date(now.getTime() + kstOffset);
        const today = kstDate.toISOString().split('T')[0];

        const statsRef = doc(db, "lina_usage", today);

        try {
            await setDoc(statsRef, {
                [appName]: increment(1), // 1분 단위 누적
                updatedAt: serverTimestamp()
            }, { merge: true });
            console.log(`[Monitor] ${appName} usage reported at ${kstDate.toLocaleTimeString()}`);
        } catch (e) {
            console.warn("[Monitor] Reporting failed (might be network or config):", e.message);
        }
    }
}

// 1분(60000ms)마다 보고
setInterval(reportUsage, 60000);

// 첫 로드 시 보고
reportUsage();

// 가시성 변화 대응 (탭 전환 등)
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        reportUsage();
    }
});
