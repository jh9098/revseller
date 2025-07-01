import { useState } from 'react';
import SellerLayout from '../../components/seller/SellerLayout';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { ko } from 'date-fns/locale';

// --- 데이터 정의: 트래픽 상품 목록 ---
const initialTrafficProducts = [
  { category: '베이직 트래픽', name: '피에스타', description: '', retailPrice: 60000, discountRate: 0.44 },
  { category: '베이직 트래픽', name: '시그니처', description: '', retailPrice: 50000, discountRate: 0.36 },
  { category: '애드온 트래픽', name: 'CP', description: '', retailPrice: 60000, discountRate: 0.42 },
  { category: '애드온 트래픽', name: '솔트', description: '', retailPrice: 70000, discountRate: 0.40 },
  { category: '애드온 트래픽', name: 'BBS', description: '', retailPrice: 80000, discountRate: 0.56 },
  { category: '애드온 트래픽', name: '팡팡', description: '', retailPrice: 60000, discountRate: 0.34 },
];

export default function TrafficPage() {
  // 각 상품에 대한 사용자 입력(수량, 요청일) 및 계산된 값을 포함하는 상태
  const [products, setProducts] = useState(
    initialTrafficProducts.map(p => ({
      ...p,
      salePrice: Math.round(p.retailPrice * (1 - p.discountRate)),
      quantity: 0,
      requestDate: null,
    }))
  );

  // 사용자 입력 처리 함수
  const handleInputChange = (index, field, value) => {
    const newProducts = [...products];
    // 수량은 숫자형으로 변환, 음수 방지
    const finalValue = field === 'quantity' ? Math.max(0, Number(value)) : value;
    newProducts[index] = { ...newProducts[index], [field]: finalValue };
    setProducts(newProducts);
  };

  // 전체 견적 합계 계산
  const totalEstimate = products.reduce((sum, p) => sum + (p.salePrice * p.quantity), 0);

  // --- 스타일 클래스 정의 ---
  const thClass = "px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-100";
  const tdClass = "px-4 py-3 whitespace-nowrap text-sm text-gray-800 border-b border-gray-200";
  const inputClass = "w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-center";

  return (
    <SellerLayout>
      <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">트래픽 요청서</h1>
        <div className="mb-8 p-4 bg-blue-50 border-l-4 border-blue-400 text-gray-700 rounded-r-lg">
          <ul className="list-disc list-inside space-y-2 text-sm">
            <li>베이직 트래픽 2종은 자가 세팅 / 애드온 트래픽 4종은 정보 전달하여 개발사 대리 세팅</li>
            <li>베이직 트래픽 2종으로 상품 키워드별 순위 체크하시면 좋습니다. 상품마다 잘 작동하는 트래픽이 다를 수 있습니다. 애드온 트래픽으로 섞어 사용하여, 쿠팡 로직 변경에 적극 대응하시면 좋습니다.</li>
            <li>어떤 트래픽 프로그램을 사용하든 체험단 진행 혹은 오가닉 매출 발생이 필수적입니다. 트래픽만 사용했을 때 순위 보정 효과가 크지 않을 수 있습니다.</li>
          </ul>
        </div>

        <div className="bg-white rounded-xl shadow-lg overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                {['구분', '상품명', '설명', '가격', '구매 개수', '요청일자', '시작일자', '종료일자', '트래픽 견적'].map(h => 
                  <th key={h} className={thClass}>{h}</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white">
              {products.map((p, index) => {
                // 날짜 자동 계산
                const startDate = p.requestDate ? new Date(p.requestDate.getTime() + 24 * 60 * 60 * 1000) : null;
                const endDate = startDate ? new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000) : null;
                const estimate = p.salePrice * p.quantity;

                return (
                  <tr key={index}>
                    <td className={tdClass}>{p.category}</td>
                    <td className={`${tdClass} font-semibold`}>{p.name}</td>
                    <td className={tdClass}>{p.description}</td>
                    <td className={`${tdClass} text-xs`}>
                      <div className="flex flex-col">
                        <span>시중가: {p.retailPrice.toLocaleString()}원</span>
                        <span className="text-red-600">할인율: {p.discountRate * 100}%</span>
                        <span className="font-bold text-blue-600 text-sm">판매가: {p.salePrice.toLocaleString()}원</span>
                      </div>
                    </td>
                    <td className={tdClass}>
                      <input 
                        type="number"
                        value={p.quantity}
                        onChange={(e) => handleInputChange(index, 'quantity', e.target.value)}
                        className={inputClass}
                        min="0"
                      />
                    </td>
                    <td className={tdClass}>
                      <DatePicker
                        selected={p.requestDate}
                        onChange={(date) => handleInputChange(index, 'requestDate', date)}
                        className={inputClass}
                        dateFormat="yyyy/MM/dd"
                        locale={ko}
                        placeholderText="날짜 선택"
                      />
                    </td>
                    <td className={tdClass}>
                      {startDate ? startDate.toLocaleDateString() : '-'}
                    </td>
                    <td className={tdClass}>
                      {endDate ? endDate.toLocaleDateString() : '-'}
                    </td>
                    <td className={`${tdClass} font-bold text-lg text-green-600`}>
                      {estimate.toLocaleString()}원
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="p-6 bg-gray-50 rounded-b-xl text-right">
            <p className="text-gray-800">
              최종 트래픽 견적 합계: 
              <span className="ml-4 font-bold text-3xl text-blue-700">{totalEstimate.toLocaleString()}</span> 원
            </p>
            <button
              disabled={totalEstimate === 0}
              className="mt-4 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-lg shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              견적 요청하기
            </button>
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}