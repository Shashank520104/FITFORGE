\getenv auth_database POSTGRES_DB
\getenv auth_password AUTH_DATABASE_PASSWORD
\getenv nutrition_database NUTRITION_DATABASE_NAME
\getenv nutrition_password NUTRITION_DATABASE_PASSWORD
\getenv progress_database PROGRESS_DATABASE_NAME
\getenv progress_password PROGRESS_DATABASE_PASSWORD
\getenv profile_database PROFILE_DATABASE_NAME
\getenv profile_password PROFILE_DATABASE_PASSWORD
\getenv personalization_database PERSONALIZATION_DATABASE_NAME
\getenv personalization_password PERSONALIZATION_DATABASE_PASSWORD

SELECT format('CREATE ROLE auth_owner LOGIN PASSWORD %L', :'auth_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'auth_owner')
\gexec

SELECT format('CREATE ROLE nutrition_owner LOGIN PASSWORD %L', :'nutrition_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nutrition_owner')
\gexec

SELECT format('CREATE ROLE progress_owner LOGIN PASSWORD %L', :'progress_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'progress_owner')
\gexec

SELECT format('CREATE ROLE profile_owner LOGIN PASSWORD %L', :'profile_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'profile_owner')
\gexec

SELECT format('CREATE ROLE personalization_owner LOGIN PASSWORD %L', :'personalization_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'personalization_owner')
\gexec

SELECT format('ALTER DATABASE %I OWNER TO auth_owner', :'auth_database')
\gexec

SELECT format('ALTER SCHEMA public OWNER TO auth_owner')
\gexec

SELECT format('CREATE DATABASE %I OWNER nutrition_owner', :'nutrition_database')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'nutrition_database')
\gexec

SELECT format('CREATE DATABASE %I OWNER progress_owner', :'progress_database')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'progress_database')
\gexec

SELECT format('CREATE DATABASE %I OWNER profile_owner', :'profile_database')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'profile_database')
\gexec

SELECT format('CREATE DATABASE %I OWNER personalization_owner', :'personalization_database')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'personalization_database')
\gexec
