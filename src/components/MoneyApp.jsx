import React, { useState, useEffect } from 'react';
import { Trash2, Plus, Minus, X as XIcon, History as HistoryIcon, Sparkles, Heart } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, doc, onSnapshot, query, orderBy, setDoc, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const appId = 'taerin-app';

const MoneyApp = () => {
    const [activeTab, setActiveTab] = useState('money');
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState([]);
    const [coupons, setCoupons] = useState([]);
    const [couponHistory, setCouponHistory] = useState([]);

    const [showMoneyModal, setShowMoneyModal] = useState(false);
    const [moneyType, setMoneyType] = useState('expense');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [confirmModal, setConfirmModal] = useState(null);

    // Initial Coupon Data (for first setup)
    const initialCoupons = [
        { id: 1, name: '뽑기 1천원 추가', count: 0, icon: '💰', borderColor: 'border-yellow-200' },
        { id: 2, name: '알리선물 1천원', count: 0, icon: '🎁', borderColor: 'border-pink-200' },
        { id: 3, name: '티비 10분 보기', count: 0, icon: '📺', borderColor: 'border-blue-200' },
        { id: 4, name: '엄마와 10분 놀기', count: 0, icon: '👩‍❤️‍👩', borderColor: 'border-purple-200' },
        { id: 5, name: '아빠와 10분 놀기', count: 0, icon: '👨‍❤️‍👨', borderColor: 'border-indigo-200' },
    ];

    // --- Firebase Subscription ---
    useEffect(() => {
        let unsubCoupons, unsubTx, unsubCH;

        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                // 1. Coupons Listener
                const couponRef = doc(db, 'artifacts', appId, 'public', 'data', 'money_data', 'coupons');
                unsubCoupons = onSnapshot(couponRef, (docSnap) => {
                    if (docSnap.exists()) {
                        setCoupons(docSnap.data().list);
                    } else {
                        // Init if missing
                        setDoc(docSnap.ref, { list: initialCoupons });
                    }
                });

                // 2. Transactions Listener
                const txRef = collection(db, 'artifacts', appId, 'public', 'data', 'money_transactions');
                const qTx = query(txRef, orderBy("timestamp", "desc"));
                unsubTx = onSnapshot(qTx, (snapshot) => {
                    const txList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                    setTransactions(txList);
                    // Calc Balance
                    const bal = txList.reduce((acc, curr) => curr.type === 'income' ? acc + curr.amount : acc - curr.amount, 0);
                    setBalance(bal);
                });

                // 3. Coupon History Listener
                const chRef = collection(db, 'artifacts', appId, 'public', 'data', 'coupon_history');
                const qCH = query(chRef, orderBy("timestamp", "desc"));
                unsubCH = onSnapshot(qCH, (snapshot) => {
                    setCouponHistory(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
                });
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubCoupons) unsubCoupons();
            if (unsubTx) unsubTx();
            if (unsubCH) unsubCH();
        };
    }, []);

    const handleAddTransaction = async () => {
        if (!amount || !description) return;
        const val = parseInt(amount);
        if (isNaN(val) || val <= 0) return;

        try {
            const txRef = collection(db, 'artifacts', appId, 'public', 'data', 'money_transactions');
            await addDoc(txRef, {
                type: moneyType,
                amount: val,
                description: description,
                date: new Date().toLocaleDateString(),
                timestamp: serverTimestamp()
            });
            setAmount(''); setDescription(''); setShowMoneyModal(false);
        } catch {
            alert("저장 실패: DB 권한을 확인해주세요.");
        }
    };

    const handleDelete = async (id, type) => {
        if (!window.confirm('정말 지울까요? (가족 모두에게서 지워져요)')) return;
        try {
            if (type === 'money') {
                await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'money_transactions', id));
            } else {
                await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'coupon_history', id));
            }
        } catch { alert(); }
    };

    const processCouponAction = async () => {
        if (!confirmModal) return;
        const { type, coupon } = confirmModal;
        const adjustment = type === 'get' ? 1 : -1;

        try {
            // Update Coupon Count
            const couponRef = doc(db, 'artifacts', appId, 'public', 'data', 'money_data', 'coupons');
            const newCoupons = coupons.map(c => c.id === coupon.id ? { ...c, count: c.count + adjustment } : c);
            await setDoc(couponRef, { list: newCoupons });

            // Add History
            const chRef = collection(db, 'artifacts', appId, 'public', 'data', 'coupon_history');
            await addDoc(chRef, {
                couponId: coupon.id,
                couponName: coupon.name,
                icon: coupon.icon,
                type: type,
                date: new Date().toLocaleDateString(),
                timestamp: serverTimestamp()
            });
            setConfirmModal(null);
        } catch { alert(); }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto shadow-2xl overflow-hidden font-sans border-x border-gray-200">
            <header className="bg-gradient-to-br from-indigo-500 to-violet-500 pt-8 pb-10 px-6 rounded-b-[2.5rem] shadow-xl z-10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-10 -mt-10"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-10 rounded-full -ml-10 -mb-10"></div>
                <div className="flex justify-between items-center text-white/90 mb-6 relative z-10">
                    <h1 className="text-xl font-bold flex items-center gap-2 font-cute">
                        <span className="bg-white/20 p-1.5 rounded-lg text-lg">👛</span>
                        태린이의 지갑
                    </h1>
                    <span className="text-xs font-bold bg-white/20 text-white px-3 py-1.5 rounded-full flex items-center gap-1">
                        <Heart size={10} className="fill-current text-pink-300" /> 아빠가 응원해!
                    </span>
                </div>
                <div className="text-center relative z-10">
                    <p className="text-indigo-100 text-sm font-medium mb-1 flex justify-center items-center gap-1">
                        <Sparkles size={14} className="text-yellow-300" /> 현재 모은 용돈 <Sparkles size={14} className="text-yellow-300" />
                    </p>
                    <div className="text-5xl font-black text-white tracking-tight drop-shadow-lg font-cute">
                        {balance.toLocaleString()}<span className="text-2xl font-bold ml-1 opacity-80">원</span>
                    </div>
                </div>
            </header>

            <div className="flex px-6 -mt-7 z-20 gap-3">
                {['money', 'coupon'].map((tab) => (
                    <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl shadow-sm transition-all duration-300 border-none outline-none ${activeTab === tab ? 'bg-white text-indigo-600 font-bold ring-2 ring-indigo-50 shadow-lg transform -translate-y-1' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                        {tab === 'money' ? <span className="text-lg">🐷</span> : <span className="text-lg">🎟️</span>}
                        <span className="font-cute text-base">{tab === 'money' ? '용돈 기록장' : '쿠폰 보물함'}</span>
                    </button>
                ))}
            </div>

            <main className="flex-1 p-6 overflow-y-auto pb-28 scrollbar-hide">
                {activeTab === 'money' && (
                    <div className="animate-fade-in space-y-4">
                        <h2 className="text-gray-800 font-bold text-lg flex items-center gap-2 mb-2 font-cute">
                            <HistoryIcon size={18} className="text-indigo-400" /> 히스토리
                        </h2>
                        {transactions.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-3xl border-2 border-dashed border-gray-100 flex flex-col items-center">
                                <span className="text-6xl mb-4 opacity-50 grayscale">📝</span>
                                <p className="text-gray-400 font-bold m-0 mt-4">아직 기록이 없어요!</p>
                                <p className="text-gray-300 text-sm mt-1 mb-0">용돈을 받거나 쓰면 기록해봐요</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {transactions.map(tx => (
                                    <div key={tx.id} className="flex items-center justify-between bg-white p-3 rounded-2xl shadow-sm mb-2 border-l-4 border-l-transparent hover:border-l-indigo-300 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-full ${tx.type === 'income' ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>
                                                {tx.type === 'income' ? '🙆‍♂️' : '💸'}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-800 text-sm m-0">{tx.description}</p>
                                                <p className="text-xs text-gray-400 m-0 mt-1">{tx.date}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`font-bold text-lg ${tx.type === 'income' ? 'text-blue-600' : 'text-red-600'}`}>
                                                {tx.type === 'income' ? '+' : '-'}{tx.amount.toLocaleString()}
                                            </span>
                                            <button onClick={() => handleDelete(tx.id, 'money')} className="text-gray-300 hover:text-red-400 p-2 bg-transparent border-none outline-none cursor-pointer"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                {activeTab === 'coupon' && (
                    <div className="animate-fade-in space-y-6">
                        <div className="grid grid-cols-2 gap-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
                            {coupons.map(coupon => (
                                <div key={coupon.id} className={`relative flex flex-col justify-between p-4 rounded-3xl shadow-lg border-2 bg-white ${coupon.borderColor} transition-all duration-200 transform active:scale-95`}>
                                    <div className="flex flex-col items-center mb-2">
                                        <div className="text-6xl mb-2 drop-shadow-sm filter hover:brightness-110 cursor-pointer">{coupon.icon}</div>
                                        <h3 className="text-gray-800 font-bold text-center text-sm break-keep leading-tight h-10 flex items-center justify-center font-cute text-lg m-0 mb-4">{coupon.name}</h3>
                                    </div>
                                    <div className="bg-gray-50 rounded-2xl py-2 mb-3 text-center border border-gray-100 mt-auto">
                                        <span className="text-xs text-gray-400 font-medium">지금 내 보물 💎</span>
                                        <div className={`text-3xl font-black ${coupon.count > 0 ? 'text-gray-800' : 'text-gray-300'}`}>{coupon.count}<span className="text-sm font-normal ml-1 text-gray-500">장</span></div>
                                    </div>
                                    <div className="flex gap-2 w-full mt-2" style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button style={{ flex: 1, padding: '0.75rem' }} onClick={() => setConfirmModal({ type: 'get', coupon })} className="rounded-xl bg-blue-50 text-blue-600 font-bold text-xs hover:bg-blue-100 border border-blue-200 transition-colors flex flex-col items-center justify-center gap-1 cursor-pointer"><Plus size={14} />받기</button>
                                        <button style={{ flex: 1, padding: '0.75rem' }} onClick={() => setConfirmModal({ type: 'use', coupon })} disabled={coupon.count <= 0} className={`rounded-xl text-white font-bold text-xs shadow-sm transition-colors flex flex-col items-center justify-center gap-1 border-none outline-none cursor-pointer ${coupon.count > 0 ? 'bg-red-400 hover:bg-red-500' : 'bg-gray-300 cursor-not-allowed'}`}><Minus size={14} />쓰기</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div>
                            <h2 className="text-gray-800 font-bold text-lg flex items-center gap-2 mb-3 mt-6 border-t border-gray-200 pt-6 font-cute"><HistoryIcon size={18} className="text-indigo-400" /> 쿠폰 쓴 기록</h2>
                            <div className="space-y-2">
                                {couponHistory.map(h => (
                                    <div key={h.id} className="flex items-center justify-between bg-white p-3 rounded-2xl shadow-sm mb-2 border border-gray-100">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-full text-2xl ${h.type === 'get' ? 'bg-blue-50' : 'bg-red-50'}`}>{h.icon}</div>
                                            <div>
                                                <p className="font-bold text-gray-800 text-sm m-0 mb-1">{h.couponName} <span className={`ml-2 text-xs font-normal px-2 py-0.5 rounded-full ${h.type === 'get' ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>{h.type === 'get' ? '받았다!' : '썼다!'}</span></p>
                                                <p className="text-xs text-gray-400 m-0">{h.date}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => handleDelete(h.id, 'coupon')} className="text-gray-300 hover:text-red-400 p-2 bg-transparent border-none outline-none cursor-pointer"><Trash2 size={14} /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {activeTab === 'money' && (
                <div className="fixed bottom-6 left-0 right-0 flex justify-center gap-3 px-6 max-w-md mx-auto z-30 pointer-events-none">
                    <button onClick={() => { setMoneyType('income'); setShowMoneyModal(true); }} className="flex-1 bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white py-4 rounded-2xl shadow-lg shadow-blue-200 flex items-center justify-center gap-2 font-bold transition-transform active:scale-95 pointer-events-auto border-none outline-none cursor-pointer text-[1rem]"><span>🙆‍♂️</span> 용돈 받음!</button>
                    <button onClick={() => { setMoneyType('expense'); setShowMoneyModal(true); }} className="flex-1 bg-gradient-to-r from-red-400 to-red-500 hover:from-red-500 hover:to-red-600 text-white py-4 rounded-2xl shadow-lg shadow-red-200 flex items-center justify-center gap-2 font-bold transition-transform active:scale-95 pointer-events-auto border-none outline-none cursor-pointer text-[1rem]"><span>💸</span> 돈 썼어요</button>
                </div>
            )}

            {showMoneyModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-end justify-center p-4 animate-fade-in" style={{ alignItems: 'center' }}>
                    <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl transform transition-all translate-y-0 relative">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2 font-cute m-0">{moneyType === 'income' ? '🎉 야호! 용돈이다!' : '💸 어디에 썼나요?'}</h3>
                            <button onClick={() => setShowMoneyModal(false)} className="bg-gray-100 p-2 rounded-full text-gray-500 hover:bg-gray-200 border-none outline-none cursor-pointer"><XIcon size={20} /></button>
                        </div>
                        <div className="space-y-5">
                            <div className="relative bg-gray-50 p-4 rounded-2xl">
                                <label className="text-xs font-bold text-gray-400 mb-1 block">얼마?</label>
                                <div className="flex items-center justify-center">
                                    <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="w-full text-4xl font-black text-center bg-transparent outline-none border-none text-gray-800 placeholder-gray-200" autoFocus />
                                    <span className="text-lg font-bold text-gray-500 ml-1">원</span>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 mb-2 block ml-1 mt-4">내용</label>
                                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={moneyType === 'income' ? "예: 설거지 도와드림 🧼" : "예: 떡볶이 냠냠 😋"} className="w-full p-4 bg-gray-50 rounded-2xl text-lg font-medium outline-none border-2 border-transparent focus:border-indigo-200 focus:bg-white transition-all box-border" />
                            </div>
                            <button onClick={handleAddTransaction} className={`w-full py-4 rounded-2xl text-white font-bold text-lg mt-6 shadow-lg transform active:scale-95 transition-all border-none outline-none cursor-pointer ${moneyType === 'income' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-red-500 hover:bg-red-600'}`}>저장하기 ✨</button>
                        </div>
                    </div>
                </div>
            )}

            {confirmModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-fade-in">
                    <div className="bg-white w-full max-w-xs rounded-[2rem] p-6 shadow-2xl text-center relative overflow-hidden">
                        <div className={`absolute top-0 left-0 w-full h-3 ${confirmModal.type === 'get' ? 'bg-blue-400' : 'bg-red-400'}`}></div>
                        <div className="text-6xl mb-4 mt-4 animate-bounce inline-block filter drop-shadow-md">{confirmModal.coupon.icon}</div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2 font-cute m-0">{confirmModal.type === 'get' ? '쿠폰을 받을까요? 🎁' : '쿠폰을 쓸까요? ✨'}</h3>
                        <div className="bg-gray-50 rounded-xl p-3 mb-6 mt-4">
                            <p className="font-bold text-indigo-600 text-lg mb-1 m-0">"{confirmModal.coupon.name}"</p>
                            <p className="text-gray-400 text-xs m-0 mt-2">{confirmModal.type === 'get' ? '참 잘했어요! 칭찬해요 👏' : `현재 ${confirmModal.coupon.count}장 남았어요`}</p>
                        </div>
                        <div className="flex gap-3" style={{ display: 'flex', gap: '0.75rem' }}>
                            <button onClick={() => setConfirmModal(null)} className="flex-1 py-3 bg-gray-100 text-gray-500 font-bold rounded-xl text-sm hover:bg-gray-200 transition-colors border-none outline-none cursor-pointer">아니요</button>
                            <button onClick={processCouponAction} className={`flex-1 py-3 text-white font-bold rounded-xl shadow-lg text-sm transition-transform active:scale-95 border-none outline-none cursor-pointer ${confirmModal.type === 'get' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-red-500 hover:bg-red-600'}`}>{confirmModal.type === 'get' ? '네, 주세요!' : '네, 쓸래요!'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MoneyApp;
