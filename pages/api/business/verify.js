// pages/api/business/verify.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Only POST requests allowed' });
  }

  // 1. 요청으로 들어온 사업자 번호 확인
  const { b_no } = req.body;
  console.log('[API-LOG] Received b_no:', b_no);

  if (!b_no) {
    return res.status(400).json({ message: '사업자 번호를 입력해주세요.' });
  }

  // 2. 환경 변수에서 서비스 키를 제대로 읽어왔는지 확인
  const serviceKey = process.env.NTS_API_SERVICE_KEY;
  console.log('[API-LOG] Service Key loaded:', serviceKey ? 'Yes' : 'No');

  if (!serviceKey) {
    return res.status(500).json({ message: '서버에 서비스 키가 설정되지 않았습니다.' });
  }

  // 3. 최종 요청 URL 확인
  const NTS_API_URL = `https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${encodeURIComponent(serviceKey)}`;
  console.log('[API-LOG] Encoded Request URL:', NTS_API_URL); // 로그도 수정해서 확인

  const requestBody = { b_no: [b_no] }; // API 명세상 배열이 맞습니다.
  console.log('[API-LOG] Request Body:', JSON.stringify(requestBody));

  try {
    const apiResponse = await fetch(NTS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await apiResponse.text(); // 응답을 텍스트로 먼저 받아서 확인
    console.log('[API-LOG] NTS API Raw Response:', responseText);

    if (!apiResponse.ok) {
        // 에러가 발생하면, 국세청이 보낸 에러 메시지를 그대로 클라이언트에게 전달
        return res.status(apiResponse.status).json({ message: `국세청 API 에러: ${responseText}` });
    }

    const result = JSON.parse(responseText); // 텍스트를 JSON으로 파싱
    
    if (result && result.data && result.data.length > 0) {
        res.status(200).json(result.data[0]);
    } else {
        res.status(400).json({ message: '사업자 정보를 확인할 수 없습니다.' });
    }

  } catch (error) {
    console.error('[API-ERROR] Catch block error:', error);
    res.status(500).json({ message: '서버에서 오류가 발생했습니다.' });
  }
}