import Link from 'next/link';

export default function SellerLayout({ children }) {
  return (
    <div className="flex">
      <aside className="w-64 bg-gray-800 text-white min-h-screen p-4">
        <h1 className="text-2xl font-bold mb-8">판매자 페이지</h1>
        <nav>
          <ul>
            <li className="mb-4">
              <Link href="/dashboard/products" className="hover:bg-gray-700 p-2 rounded block">
                예약하기
              </Link>
            </li>
            <li className="mb-4">
              <Link href="/seller/progress" className="hover:bg-gray-700 p-2 rounded block">
                진행현황
              </Link>
            </li>
            <li className="mb-4">
              <Link href="/seller/traffic" className="hover:bg-gray-700 p-2 rounded block">
                트래픽
              </Link>
            </li>
            <li className="mb-4">
              <Link href="/seller/keyword" className="hover:bg-gray-700 p-2 rounded block">
                키워드분석
              </Link>
            </li>
          </ul>
        </nav>
      </aside>
      <main className="flex-1 p-8 bg-gray-100">
        {children}
      </main>
    </div>
  );
}
