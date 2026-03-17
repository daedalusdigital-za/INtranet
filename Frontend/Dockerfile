# Build stage - use pre-built dist folder to avoid npm network issues
# First build locally: npm install && npm run build -- --configuration=production
FROM nginx:alpine

# Remove default nginx config
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy pre-built Angular app
COPY dist/frontend/browser /usr/share/nginx/html

# Copy full nginx config (includes worker tuning, gzip_static, security headers)
COPY nginx.conf /etc/nginx/nginx.conf

# Health check (use 127.0.0.1 instead of localhost - BusyBox wget resolves localhost to IPv6 first)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1/health || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
