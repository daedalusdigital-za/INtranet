# Build stage - use pre-built dist folder to avoid npm network issues
# First build locally: npm install && npm run build -- --configuration=production
FROM nginx:alpine

# Copy pre-built Angular app
COPY dist/frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
