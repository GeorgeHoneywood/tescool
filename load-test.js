// run with:
// k6 run load-test.js

import http from 'k6/http'
import { sleep } from 'k6';

export const options = {
    vus: 10,
    duration: '100s',
};

export default function () {
    http.get('http://127.0.0.1:5173')//, {cookies: {"dailyChallengeDate": "2023-4-9"}});
    sleep(1);
}