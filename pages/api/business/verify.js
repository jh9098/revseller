export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Only POST requests allowed' });
  }

  const { b_no } = req.body;

  if (!b_no) {
    return res.status(400).json({ message: '사업자 번호를 입력해주세요.' });
  }

  const NTS_API_URL = `https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${process.env.NTS_API_SERVICE_KEY}`;

  try {
    const apiResponse = await fetch(NTS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        b_no: [b_no],
      }),
    });

    if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        console.error('NTS API Error:', errorText);
        return res.status(apiResponse.status).json({ message: '국세청 API 호출에 실패했습니다.' });
    }

    const result = await apiResponse.json();
    
    if (result && result.data && result.data.length > 0) {
        res.status(200).json(result.data[0]);
    } else {
        res.status(400).json({ message: '사업자 정보를 확인할 수 없습니다.' });
    }

  } catch (error) {
    console.error('사업자 인증 API 오류:', error);
    res.status(500).json({ message: '서버에서 오류가 발생했습니다.' });
  }
}
