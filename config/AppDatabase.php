<?php
/** Shared MySQLi-backed application query and statement helpers. */
final class AppDatabase
{
    public const FETCH_ASSOC = 2;
    public const FETCH_NUM = 3;
    public const FETCH_COLUMN = 7;

    private mysqli $connection;
    private bool $transaction = false;

    public function __construct(mysqli $connection)
    {
        $this->connection = $connection;
    }

    public function prepare(string $sql): AppStatement
    {
        $statement = $this->connection->prepare($sql);
        if (!$statement instanceof mysqli_stmt) {
            throw new RuntimeException('Database statement preparation failed: ' . $this->connection->error);
        }
        return new AppStatement($this->connection, $statement);
    }

    public function query(string $sql): AppStatement
    {
        $result = $this->connection->query($sql);
        if ($result === false) {
            throw new RuntimeException('Database query failed: ' . $this->connection->error);
        }
        return AppStatement::fromResult($this->connection, $result);
    }

    public function exec(string $sql): int
    {
        if ($this->connection->query($sql) === false) {
            throw new RuntimeException('Database command failed: ' . $this->connection->error);
        }
        return $this->connection->affected_rows;
    }

    public function lastInsertId(): string
    {
        return (string) $this->connection->insert_id;
    }

    public function beginTransaction(): bool
    {
        $ok = $this->connection->begin_transaction();
        $this->transaction = true;
        return $ok;
    }

    public function commit(): bool
    {
        $ok = $this->connection->commit();
        $this->transaction = false;
        return $ok;
    }

    public function rollBack(): bool
    {
        $ok = $this->connection->rollback();
        $this->transaction = false;
        return $ok;
    }

    public function inTransaction(): bool
    {
        return $this->transaction;
    }

    public function rawConnection(): mysqli
    {
        return $this->connection;
    }
}

final class AppStatement
{
    private mysqli $connection;
    private ?mysqli_stmt $statement = null;
    private mysqli_result|bool $result = false;

    public function __construct(mysqli $connection, ?mysqli_stmt $statement)
    {
        $this->connection = $connection;
        $this->statement = $statement;
    }

    public static function fromResult(mysqli $connection, mysqli_result|bool $result): self
    {
        $self = new self($connection, null);
        $self->result = $result;
        return $self;
    }

    public function execute(array $params = []): bool
    {
        if (!$this->statement) {
            throw new LogicException('Cannot execute a statement without a prepared query.');
        }
        $this->result = false;
        if ($params) {
            $types = '';
            foreach ($params as $value) {
                $types .= is_int($value) || is_bool($value) ? 'i' : (is_float($value) ? 'd' : 's');
            }
            $values = array_values($params);
            $this->statement->bind_param($types, ...$values);
        }
        if (!$this->statement->execute()) {
            $this->result = false;
            throw new RuntimeException('Database statement execution failed: ' . $this->statement->error);
        }

        $result = $this->statement->get_result();
        if ($result === false && $this->statement->field_count > 0) {
            $this->result = false;
            throw new RuntimeException('Could not read the database statement result: ' . $this->statement->error);
        }
        $this->result = $result;
        return true;
    }

    public function fetch(int $mode = AppDatabase::FETCH_ASSOC): array|false
    {
        if (!$this->result instanceof mysqli_result) return false;
        $row = $mode === AppDatabase::FETCH_NUM
            ? $this->result->fetch_row()
            : $this->result->fetch_assoc();
        return $row === null || $row === false ? false : $row;
    }

    public function fetchAll(int $mode = AppDatabase::FETCH_ASSOC): array
    {
        if (!$this->result instanceof mysqli_result) return [];
        $rows = $this->result->fetch_all(MYSQLI_ASSOC);
        if ($mode === AppDatabase::FETCH_COLUMN || $mode === 7) {
            return array_map(static fn(array $row) => array_values($row)[0] ?? null, $rows);
        }
        return $rows;
    }

    public function fetchColumn(int $column = 0): mixed
    {
        $row = $this->fetch();
        return $row === false ? false : (array_values($row)[$column] ?? false);
    }

    public function rowCount(): int
    {
        return $this->statement ? $this->statement->affected_rows : ($this->result instanceof mysqli_result ? $this->result->num_rows : 0);
    }

    public function closeCursor(): bool
    {
        if ($this->statement) $this->statement->close();
        if ($this->result instanceof mysqli_result) $this->result->free();
        return true;
    }
}
