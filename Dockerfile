FROM node:14

WORKDIR /usr/src/app

COPY . .

RUN npm install

EXPOSE 3000

ENV REDIS_HOST redis

CMD ["node", "index.js"]
