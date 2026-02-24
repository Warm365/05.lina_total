import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

const UsageApp = () => {
    const [usageData, setUsageData] = useState({});
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(() => {
        const now = new Date();
        const kstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000));
        return kstDate.toISOString().split('T')[0];
    });

    // 앱 이름 매핑 (ID -> 한글 명칭)
    const appNames = {
        'lina-portal': '🌈 태린이 놀이동산',
        'lina-total': '👛 용돈·학습 총괄앱',
        'lina-sanmemo': '☁️ 산리오 메모리 게임',
        'lina-domino': '🧸 산리오 도미노',
        'lina-dice': '🎲 100칸 주사위 게임',
        'lina-casino': '🎰 델럭스 카지노',
        'unknown-app': '❓ 기타 앱'
    };

    useEffect(() => {
        setLoading(true);
        const docRef = doc(db, "lina_usage", selectedDate);

        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                setUsageData(docSnap.data());
            } else {
                setUsageData({});
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching usage data:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [selectedDate]);

    const totalMinutes = Object.entries(usageData)
        .filter(([key]) => key !== 'updatedAt')
        .reduce((acc, [_, val]) => acc + (typeof val === 'number' ? val : 0), 0);

    const formatTime = (mins) => {
        if (mins < 60) return `${mins}분`;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${h}시간 ${m}분`;
    };

    return (
        <div id="usage-app-wrapper" className="animate-fade-in p-4">
            <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden border border-pink-100">
                {/* 헤더 */}
                <header className="bg-gradient-to-r from-pink-300 to-indigo-300 p-6 text-center relative">
                    <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
                        <div className="absolute top-2 left-4 text-2xl">⭐</div>
                        <div className="absolute bottom-2 right-4 text-2xl">🌸</div>
                    </div>
                    <img
                        src="https://t-images.netlify.app/cinnamoroll-1.png"
                        alt="시나모롤"
                        className="w-24 h-24 mx-auto mb-2 drop-shadow-md"
                    />
                    <h1 className="text-3xl font-cute text-white drop-shadow-sm">🎮 놀이 관리</h1>
                    <p className="text-white text-opacity-90 font-medium">태린이가 오늘 얼마나 즐겁게 놀았을까? ✨</p>
                </header>

                <main className="p-6">
                    {/* 날짜 선택 */}
                    <div className="flex justify-between items-center mb-6 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                        <span className="font-bold text-gray-600">📅 날짜 선택</span>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-white border border-gray-200 rounded-xl px-3 py-1 font-medium text-gray-700 outline-none focus:ring-2 focus:ring-pink-300"
                        />
                    </div>

                    {/* 요약 카드 */}
                    <div className="bg-gradient-to-br from-indigo-50 to-pink-50 p-5 rounded-3xl mb-8 border border-white shadow-inner flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 font-bold mb-1">오늘의 총 사용 시간</p>
                            <h2 className="text-4xl font-cute text-indigo-600">{formatTime(totalMinutes)}</h2>
                        </div>
                        <div className="text-5xl">⏱️</div>
                    </div>

                    {/* 상세 내역 리스트 */}
                    <section className="space-y-4">
                        <h3 className="font-bold text-gray-700 flex items-center gap-2 mb-2">
                            <span className="text-pink-400">📋</span> 상세 활동 내역
                        </h3>

                        {loading ? (
                            <div className="text-center py-10 text-gray-400 font-medium">데이터를 불러오는 중이에요... ☁️</div>
                        ) : Object.keys(usageData).filter(k => k !== 'updatedAt').length > 0 ? (
                            Object.entries(usageData)
                                .filter(([key]) => key !== 'updatedAt')
                                .sort((a, b) => b[1] - a[1]) // 시간 많은 순 정렬
                                .map(([id, mins]) => (
                                    <div key={id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-pink-50 rounded-full flex items-center justify-center text-xl">
                                                {id.includes('dice') ? '🎲' : id.includes('memo') ? '☁️' : id.includes('portal') ? '🌈' : id.includes('total') ? '👛' : id.includes('domino') ? '🧸' : id.includes('casino') ? '🎰' : '🧩'}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-800">{appNames[id] || id}</p>
                                                <div className="w-32 h-2 bg-gray-100 rounded-full mt-1 overflow-hidden">
                                                    <div
                                                        className="h-full bg-pink-300 rounded-full"
                                                        style={{ width: `${Math.min(100, (mins / (totalMinutes || 1)) * 100)}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>
                                        <p className="font-cute text-xl text-pink-500">{formatTime(mins)}</p>
                                    </div>
                                ))
                        ) : (
                            <div className="text-center py-10 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                                <p className="text-gray-400 font-medium">아직 기록된 활동이 없어요! 🌸</p>
                                <p className="text-xs text-gray-300 mt-1">게임을 시작하면 1분 뒤에 기록이 나타나요.</p>
                            </div>
                        )}
                    </section>

                    {/* 시나모롤의 메시지 */}
                    <div className="mt-8 bg-blue-50 p-4 rounded-2xl border border-blue-100 flex gap-3 items-start">
                        <div className="text-2xl">☁️</div>
                        <div>
                            <p className="text-blue-700 font-bold text-sm mb-1">시나모롤의 한마디!</p>
                            <p className="text-blue-600 text-sm leading-relaxed">
                                {totalMinutes === 0 ? "우리 태린이, 오늘 어떤 재미있는 놀이를 해볼까? 시나모롤이 기다리고 있어! 💙" :
                                    totalMinutes > 120 ? "우와! 오늘 정말 신나게 놀았구나! 하지만 눈이 피곤할 수 있으니 먼 곳을 보며 잠시 쉬어주는 건 어떨까? 🌈" :
                                        "적당히 신나게 노는 모습이 정말 멋져! 아빠랑 약속한 시간을 잘 지키는 우리 태린이는 최고야! ⭐"}
                            </p>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default UsageApp;
