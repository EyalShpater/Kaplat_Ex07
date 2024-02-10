# FROM node:14
# RUN npm install express sequelize sequelize-cli path process pg postgres fs mongoose --save
# WORKDIR /app
# COPY . .
# CMD ["npm", "start"]

FROM node:latest

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

CMD ["npm", "start"]
