# Build Application

FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./

COPY . .

RUN npm install

RUN npm run build

# Run the Application

FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --only=production

COPY --from=0 /usr/src/app/dist ./dist

EXPOSE 8080

CMD npm start