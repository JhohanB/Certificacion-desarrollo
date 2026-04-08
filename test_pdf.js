import fetch from 'node-fetch';

const url = 'http://localhost:8000/uploads/documentos/19/doc_1_v1.pdf';

fetch(url)
  .then(response => {
    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers));
    return response.text();
  })
  .then(data => {
    console.log('Response length:', data.length);
  })
  .catch(error => {
    console.error('Error:', error);
  });