import React, { useState } from 'react';
import StudyApp from './components/StudyApp';
import MoneyApp from './components/MoneyApp';
import UsageApp from './components/UsageApp';

function App() {
  const [activeTab, setActiveTab] = useState('study');

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Toast Container */}
      <div id="toast-container">알림 메시지</div>

      {/* Main Navigation - Matching Original HTML Structure */}
      <nav className="main-nav">
        <button
          className={`nav-tab ${activeTab === 'study' ? 'active' : ''}`}
          onClick={() => setActiveTab('study')}
        >
          ✏️ 오늘공부
        </button>
        <button
          className={`nav-tab money-tab ${activeTab === 'money' ? 'active' : ''}`}
          onClick={() => setActiveTab('money')}
        >
          👛 용돈관리
        </button>
        <button
          className={`nav-tab usage-tab ${activeTab === 'usage' ? 'active' : ''}`}
          style={{
            backgroundColor: activeTab === 'usage' ? '#F472B6' : 'transparent',
            boxShadow: activeTab === 'usage' ? '0 4px 6px -1px rgba(244, 114, 182, 0.3)' : 'none'
          }}
          onClick={() => setActiveTab('usage')}
        >
          🎮 놀이관리
        </button>
      </nav>

      <main>
        {activeTab === 'study' ? <StudyApp /> :
          activeTab === 'money' ? <MoneyApp /> :
            <UsageApp />}
      </main>
    </div>
  );
}

export default App;
