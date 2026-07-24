using System.Data.Common;
using Amazon.XRay.Recorder.Core;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace NotSpotify.Api.Data;

/// <summary>
/// Wraps each EF Core database command in an X-Ray "remote" subsegment named
/// "PostgreSQL", so the database shows up as a downstream node on the service map
/// (X-Ray only auto-instruments AWS SDK calls, not the Npgsql/EF data layer).
///
/// Tracing is best-effort: it no-ops when no request-scoped trace is on the context
/// (background sync jobs, startup schema patching) and swallows any recorder error,
/// so it can never affect query execution. EF raises exactly one Executed OR
/// CommandFailed for each Executing, which keeps the begin/end pairing balanced.
/// </summary>
public sealed class XRayDbCommandInterceptor : DbCommandInterceptor
{
    private const string SubsegmentName = "PostgreSQL";

    private static void Begin(DbCommand command)
    {
        try
        {
            var recorder = AWSXRayRecorder.Instance;
            if (!recorder.TraceContext.IsEntityPresent()) return;

            recorder.BeginSubsegment(SubsegmentName);
            recorder.SetNamespace("remote");
            recorder.AddSqlInformation("database_type", "PostgreSQL");
            var text = command.CommandText ?? string.Empty;
            // The command text is parameterized (no literal values), so it is safe to
            // record; cap it to keep segments small.
            recorder.AddSqlInformation("sanitized_query",
                text.Length > 1000 ? text[..1000] : text);
        }
        catch { /* tracing is best-effort */ }
    }

    private static void End()
    {
        try
        {
            var recorder = AWSXRayRecorder.Instance;
            if (recorder.TraceContext.IsEntityPresent()) recorder.EndSubsegment();
        }
        catch { /* tracing is best-effort */ }
    }

    private static void Fail(Exception? ex)
    {
        try
        {
            var recorder = AWSXRayRecorder.Instance;
            if (!recorder.TraceContext.IsEntityPresent()) return;
            if (ex is not null) recorder.AddException(ex);
            recorder.MarkFault();
            recorder.EndSubsegment();
        }
        catch { /* tracing is best-effort */ }
    }

    public override InterceptionResult<DbDataReader> ReaderExecuting(
        DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result)
    {
        Begin(command);
        return base.ReaderExecuting(command, eventData, result);
    }

    public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
        DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result,
        CancellationToken cancellationToken = default)
    {
        Begin(command);
        return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
    }

    public override InterceptionResult<int> NonQueryExecuting(
        DbCommand command, CommandEventData eventData, InterceptionResult<int> result)
    {
        Begin(command);
        return base.NonQueryExecuting(command, eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(
        DbCommand command, CommandEventData eventData, InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        Begin(command);
        return base.NonQueryExecutingAsync(command, eventData, result, cancellationToken);
    }

    public override InterceptionResult<object> ScalarExecuting(
        DbCommand command, CommandEventData eventData, InterceptionResult<object> result)
    {
        Begin(command);
        return base.ScalarExecuting(command, eventData, result);
    }

    public override ValueTask<InterceptionResult<object>> ScalarExecutingAsync(
        DbCommand command, CommandEventData eventData, InterceptionResult<object> result,
        CancellationToken cancellationToken = default)
    {
        Begin(command);
        return base.ScalarExecutingAsync(command, eventData, result, cancellationToken);
    }

    public override DbDataReader ReaderExecuted(
        DbCommand command, CommandExecutedEventData eventData, DbDataReader result)
    {
        End();
        return base.ReaderExecuted(command, eventData, result);
    }

    public override ValueTask<DbDataReader> ReaderExecutedAsync(
        DbCommand command, CommandExecutedEventData eventData, DbDataReader result,
        CancellationToken cancellationToken = default)
    {
        End();
        return base.ReaderExecutedAsync(command, eventData, result, cancellationToken);
    }

    public override int NonQueryExecuted(
        DbCommand command, CommandExecutedEventData eventData, int result)
    {
        End();
        return base.NonQueryExecuted(command, eventData, result);
    }

    public override ValueTask<int> NonQueryExecutedAsync(
        DbCommand command, CommandExecutedEventData eventData, int result,
        CancellationToken cancellationToken = default)
    {
        End();
        return base.NonQueryExecutedAsync(command, eventData, result, cancellationToken);
    }

    public override object? ScalarExecuted(
        DbCommand command, CommandExecutedEventData eventData, object? result)
    {
        End();
        return base.ScalarExecuted(command, eventData, result);
    }

    public override ValueTask<object?> ScalarExecutedAsync(
        DbCommand command, CommandExecutedEventData eventData, object? result,
        CancellationToken cancellationToken = default)
    {
        End();
        return base.ScalarExecutedAsync(command, eventData, result, cancellationToken);
    }

    public override void CommandFailed(DbCommand command, CommandErrorEventData eventData)
    {
        Fail(eventData.Exception);
        base.CommandFailed(command, eventData);
    }

    public override Task CommandFailedAsync(
        DbCommand command, CommandErrorEventData eventData, CancellationToken cancellationToken = default)
    {
        Fail(eventData.Exception);
        return base.CommandFailedAsync(command, eventData, cancellationToken);
    }
}
