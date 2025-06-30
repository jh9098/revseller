import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import withAdminAuth from '../../hoc/withAdminAuth';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';

// YYYY-MM-DD 형식으로 날짜 포맷하는 헬퍼 함수
const formatDate = (date) => date.toISOString().slice(0, 10);

function AdminSchedule() {
  const [capacities, setCapacities] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentMonthDates, setCurrentMonthDates] = useState([]);

  // 현재 월의 모든 날짜를 생성하는 로직
  useEffect(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const dates = [];
    for (let i = 1; i <= daysInMonth; i++) {
      dates.push(formatDate(new Date(year, month, i)));
    }
    setCurrentMonthDates(dates);
  }, []);
  
  // Firestore에서 capacity 데이터만 실시간으로 가져옴
  useEffect(() => {
    const capacityUnsubscribe = onSnapshot(collection(db, 'capacities'), (snap) => {
      const fetchedCaps = {};
      snap.forEach(doc => {
        fetchedCaps[doc.id] = doc.data().capacity || 0;
      });
      setCapacities(fetchedCaps);
      setLoading(false);
    });

    return () => capacityUnsubscribe();
  }, []);

  // ✅ 입력 값을 직접 처리하는 함수 (가장 중요)
  const handleCapacityChange = async (dateStr, value) => {
    // 1. 입력 값에서 숫자만 추출
    const numericValue = Number(value.replace(/[^0-9]/g, ''));

    // 2. 화면(state)에 즉시 반영
    setCapacities(prev => ({ ...prev, [dateStr]: numericValue }));

    // 3. Firestore에 저장
    try {
      await setDoc(doc(db, 'capacities', dateStr), { capacity: numericValue });
    } catch (error) {
      console.error(`[${dateStr}] Capacity 업데이트 오류:`, error);
    }
  };

  if (loading) {
    return <AdminLayout><div>로딩 중...</div></AdminLayout>;
  }

  return (
    <AdminLayout>
      <h2 className="text-2xl font-bold mb-4">예약 시트 관리 (단순화 테스트)</h2>
      <p className="text-sm text-gray-600 mb-4">
        이 페이지는 입력 버그를 잡기 위한 테스트 페이지입니다. FullCalendar를 제외하고 입력 기능만 확인합니다.
      </p>
      
      {/* FullCalendar 대신 단순한 grid 레이아웃으로 입력 필드를 나열 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {currentMonthDates.map(dateStr => (
          <div key={dateStr} className="bg-white p-3 rounded-lg shadow">
            <label className="block text-sm font-semibold">{dateStr}</label>
            <input
              type="number"
              value={capacities[dateStr] || ''} // 값이 없으면 빈 문자열 표시
              onChange={(e) => handleCapacityChange(dateStr, e.target.value)}
              className="mt-2 w-full text-center border rounded-md p-1"
              placeholder="총량"
            />
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}

export default withAdminAuth(AdminSchedule);