fetch('http://localhost:3000/api/schema')
  .then(res => {
     console.log('GET', res.status);
     return res.text();
  })
  .then(text => console.log(text.substring(0, 100)))
  .catch(err => console.error(err));


