import React, { useState } from 'react';
import StudyApp from './components/StudyApp';
import MoneyApp from './components/MoneyApp';

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
      </nav>

      <main>
        {activeTab === 'study' ? <StudyApp /> : <MoneyApp />}
      </main>
    </div>
  );
}

export default App;
