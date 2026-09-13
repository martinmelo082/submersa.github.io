// netlify/functions/calcular-frete.js
//
// Esta função roda no servidor da Netlify, nunca no navegador do cliente.
// O token do Melhor Envio fica guardado como variável de ambiente (MELHORENVIO_TOKEN)
// e nunca aparece no código do site.

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método não permitido.' }) };
  }

  const token = process.env.MELHORENVIO_TOKEN;
  if (!token) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Token do Melhor Envio não configurado no servidor.' })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Corpo da requisição inválido.' }) };
  }

  const { cepOrigem, cepDestino, peso, comprimento, largura, altura } = payload;

  if (!cepOrigem || !cepDestino) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'CEP de origem e destino são obrigatórios.' })
    };
  }

  const body = {
    from: { postal_code: String(cepOrigem).replace(/\D/g, '') },
    to: { postal_code: String(cepDestino).replace(/\D/g, '') },
    package: {
      height: Number(altura) || 4,
      width: Number(largura) || 12,
      length: Number(comprimento) || 16,
      weight: Number(peso) || 0.3
    }
  };

  try {
    const response = await fetch('https://www.melhorenvio.com.br/api/v2/me/shipment/calculate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'Loja Submersa (contato@submersa3d.com.br)'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!Array.isArray(data)) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: 'Resposta inesperada do Melhor Envio.', raw: data })
      };
    }

    const options = data
      .filter((item) => !item.error && item.company && item.company.name && item.price)
      .map((item) => ({
        carrier: item.company.name,
        service: item.name,
        price: parseFloat(item.price),
        days: item.delivery_time
      }))
      .sort((a, b) => a.price - b.price);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ options })
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Erro ao consultar o Melhor Envio.' })
    };
  }
};
