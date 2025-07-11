import Link from 'next/link';

export default function AdminLayout({ children }) {
  return (
    <div className="flex">
      <aside className="w-64 bg-gray-800 text-white min-h-screen p-4">
        <h1 className="text-2xl font-bold mb-8">관리자 페이지</h1>
        <nav>
          <ul>
            <li className="mb-4">
              <Link href="/admin/dashboard" className="hover:bg-gray-700 p-2 rounded block">
                대시보드
              </Link>
            </li>
            <li className="mb-4">
              <Link href="/admin/products" className="hover:bg-gray-700 p-2 rounded block">
                상품 관리
              </Link>
            </li>
            <li className="mb-4">
              <Link href="/admin/sellers" className="hover:bg-gray-700 p-2 rounded block">
                판매자 관리
              </Link>
            </li>
            <li className="mb-4">
              <Link href="/admin/schedule" className="hover:bg-gray-700 p-2 rounded block">
                예약 시트 관리
              </Link>
            </li>
            <li className="mb-4">
              <Link href="/admin/progress" className="hover:bg-gray-700 p-2 rounded block">
                진행현황
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