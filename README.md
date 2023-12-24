# CacheFirst

CacheFirst is an ismorphic caching library that offers fluent APIs for caching JSON, Blob, Text, and ArrayBuffer response data.

## Key Features

1. The response data is stored in in-memory or the browser cache.
2. The storage mechanism can be either in-memory or localStorage or IndexedDB, determined based on the platform ,response-type and length.
3. The callback function is immediately called if data is available in the cache.
4. The callback is invoked again only if the actual response differs from the cached response.
5. The callback receives three parameters:
   
   i. [Blob, String, Object, ArrayBuffer] - Type-converted response body based on the invoked method.
   
   ii. [Boolean] - True if the network response is different from the cached response.
   
   iii. [Response] - Wrapper of the original response, allowing operations with the original response.
   
7. SHA-256 algorithm is used to generate hash from request and response for integrity 
8. A catch callback is provided to handle errors effectively.

## Installation

To use as Module:
```
npm install cachefirst
```
Directly in HTML:
```
<script crossorigin src="https://unpkg.com/cachefirst@latest/cachefirst.min.js"></script>
```
## Usage

```
import CacheFirst from 'cachefirst';  
``` 
or  

```
<script crossorigin src="https://unpkg.com/cachefirst@latest/cachefirst.min.js"></script> 
```

```
CacheFirst.fetch("http://localhost:3000/v1/text")
    .text((data) => {
        document.body.innerHTML += "<br><br>" + data;
    })
    .catch(error => {
        console.log(error);
    });

CacheFirst.fetch("http://localhost:3000/v1/json")
    .json((data, hasDataModified, originalResponse) => {
        if (hasDataModified || originalResponse.status == 200)
            document.body.innerHTML += "<br><br>" + JSON.stringify(data);
    })
    .catch(error => {
        console.log(error);
    });

CacheFirst.fetch("http://localhost:3000/v1/blob")
    .blob((data, hasDataModified) => {
        blobToBase64(data).then(str => document.body.innerHTML += "<br><br>" + str);
    })
    .catch(error => {
        console.log(error);
    });

CacheFirst.fetch("http://localhost:3000/v1/arrayBuffer")
    .arrayBuffer((data, hasDataModified) => {
        document.body.innerHTML += "<br><br>" + new Uint8Array(data);
    });
```
# To-do
1. tests
2. check cache size and implement fallback mechanism
3. expose api's to make config changes
