# Bases de Datos NoSQL

## Formato de Intercambio de Datos

- JSON

## Modelo de Datos

### TAGs

- Persona
- Domicilio

### Relaciones

- Reside_en (entre Persona y Domicilio)

## Descripciones de URL de Servicios

### Crear Persona

- **Método**: POST
- **URL**: `http://localhost:3000/persona`
- **Content-Type**: `application/json`
- **Cuerpo**:
  ```json
  {
    "nombre": "daniela",
    "apellido": "de la Sierra",
    "ci": "47485476",
    "edad": 27
  }
  ```

### Agregar Dirección de una Persona

- **Método**: POST
- **URL**: `http://localhost:3000/domicilio/47485476`
- **Content-Type**: `application/json`
- **Cuerpo**:
  ```json
  {
    "departamento": "Montevideo",
    "localidad": "Tres Cruces",
    "calle": "Avda. Uruguay",
    "nro": 1234,
    "apartamento": 1
  }
  ```

### Obtener Dirección de una Persona

- **Método**: GET
- **URL**: `http://localhost:3000/domicilio/47485476`
- **Content-Type**: `application/json`

### Listar Todas las Direcciones

- **Método**: GET
- **URL**: `http://localhost:3000/domicilio`
- **Content-Type**: `application/json`

## Instalación

1. Clonar el proyecto desde Git.
2. Instalar Docker.
3. Añadir un archivo `.env` en la carpeta raíz del proyecto (solicitarlo si es necesario).

NEO4J_PASS="nosql2023"
NEO4J_USER="neo4j"

# DOCKER

# NEO4J_HOST=neo4j://neo4j:7687

# REDIS_URI=redis://redis:6379

# LOCAL

NEO4J_HOST=neo4j://neo4j:7687
REDIS_URI=redis://redis:6379
PORT=3000

4. Ejecutar el comando `docker-compose up -d`.
5. Acceder a la aplicación en `http://localhost:3000`.

## Bases de Datos

- Redis
- Neo4j

## Lenguajes

- Node.js
