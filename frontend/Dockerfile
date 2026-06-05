FROM nginx:alpine
COPY . /usr/share/nginx/html
# Remove Dockerfile and nginx.conf from output inside nginx to keep it clean
RUN rm -f /usr/share/nginx/html/Dockerfile /usr/share/nginx/html/nginx.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
