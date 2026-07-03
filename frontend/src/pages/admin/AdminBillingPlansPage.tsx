import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckCircleIcon,
  CreditCardIcon,
  PencilSquareIcon,
  PlusCircleIcon,
  TrashIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import {
  adminService,
  type AdminBillingPlan,
  type UpsertBillingPlanPayload,
} from '@/services/adminService'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { AdminTableSkeleton } from '@/components/common/AdminSkeleton'
import { SearchInput } from '@/components/common/SearchInput'
import { useConfirm } from '@/hooks/useConfirm'
import { notify } from '@/utils/toast'

const inputCls =
  'w-full bg-elevated border border-elevated/50 focus:border-accent text-primary rounded-md px-4 py-2.5 text-sm focus:outline-none'

const blankForm = {
  plan: '',
  tier: 'individual' as UpsertBillingPlanPayload['tier'],
  maxMembers: '1',
  interval: 'monthly' as UpsertBillingPlanPayload['interval'],
  label: '',
  cardTitle: '',
  discountLabel: '',
  perksText: '',
  finePrint: '',
  accentColor: '#ffd2d7',
  buttonColor: '#ffd2d7',
  buttonTextColor: '#000000',
  currency: 'myr',
  amount: '',
  isActive: true,
  sortOrder: '0',
}

type FormState = typeof blankForm

function readableTextColor(hex: string) {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : 'ffd2d7'
  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? '#000000' : '#ffffff'
}

function planToForm(plan: AdminBillingPlan): FormState {
  return {
    plan: plan.plan,
    tier: plan.tier,
    maxMembers: String(plan.maxMembers),
    interval: plan.interval,
    label: plan.label,
    cardTitle: plan.cardTitle,
    discountLabel: plan.discountLabel ?? '',
    perksText: plan.perks.join('\n'),
    finePrint: plan.finePrint,
    accentColor: plan.accentColor,
    buttonColor: plan.buttonColor,
    buttonTextColor: plan.buttonTextColor,
    currency: plan.currency,
    amount: (plan.unitAmount / 100).toFixed(2),
    isActive: plan.isActive,
    sortOrder: String(plan.sortOrder),
  }
}

function formToPayload(form: FormState): UpsertBillingPlanPayload {
  const amount = Number(form.amount)
  return {
    plan: form.plan.trim().toLowerCase(),
    tier: form.tier,
    maxMembers: Math.max(1, Number(form.maxMembers) || 1),
    interval: form.interval,
    label: form.label.trim(),
    cardTitle: form.cardTitle.trim() || null,
    discountLabel: form.discountLabel.trim() || null,
    perks: form.perksText
      .split('\n')
      .map((perk) => perk.trim())
      .filter(Boolean),
    finePrint: form.finePrint.trim() || null,
    accentColor: form.accentColor,
    buttonColor: form.accentColor,
    buttonTextColor: readableTextColor(form.accentColor),
    currency: form.currency.trim().toLowerCase(),
    unitAmount: Number.isFinite(amount) ? Math.round(amount * 100) : 0,
    isActive: form.isActive,
    sortOrder: Math.max(0, Number(form.sortOrder) || 0),
  }
}

function serverMessage(err: unknown, fallback: string) {
  const data = (err as { response?: { data?: string | { message?: string } } })?.response?.data
  return (typeof data === 'string' ? data : data?.message) ?? (err instanceof Error ? err.message : fallback)
}

export function AdminBillingPlansPage() {
  const confirm = useConfirm()
  const [plans, setPlans] = useState<AdminBillingPlan[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [originalForm, setOriginalForm] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(blankForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)
  const [orderingId, setOrderingId] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)

  const serializeForm = (value: FormState) => JSON.stringify(value)
  const isDirty = editingId !== null && originalForm !== null && serializeForm(form) !== originalForm

  const refreshPlans = async () => {
    const items = await adminService.listBillingPlans()
    setPlans(items)
  }

  useEffect(() => {
    let cancelled = false
    adminService.listBillingPlans()
      .then((items) => {
        if (!cancelled) setPlans(items)
      })
      .catch((err) => {
        if (!cancelled) setError(serverMessage(err, 'Failed to load billing plans.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isDirty) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const visiblePlans = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return plans
    return plans.filter((plan) =>
      plan.plan.includes(q) ||
      plan.label.toLowerCase().includes(q) ||
      plan.tier.includes(q),
    )
  }, [plans, query])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const runOrPrompt = (action: () => void) => {
    if (isDirty) {
      setPendingAction(() => action)
      return
    }
    action()
  }

  const openCreateNow = () => {
    const nextForm = {
      ...blankForm,
      sortOrder: String((plans.reduce((max, plan) => Math.max(max, plan.sortOrder), 0) || 0) + 10),
    }
    setForm(nextForm)
    setOriginalForm(serializeForm(nextForm))
    setEditingId('')
    setFormError(null)
  }

  const openCreate = () => runOrPrompt(openCreateNow)

  const openEditNow = (plan: AdminBillingPlan) => {
    const nextForm = planToForm(plan)
    setForm(nextForm)
    setOriginalForm(serializeForm(nextForm))
    setEditingId(plan.id)
    setFormError(null)
  }

  const openEdit = (plan: AdminBillingPlan) => runOrPrompt(() => openEditNow(plan))

  const closeFormNow = () => {
    setEditingId(null)
    setOriginalForm(null)
    setFormError(null)
  }

  const closeForm = () => runOrPrompt(closeFormNow)

  const saveForm = async () => {
    if (!form.plan.trim() || !form.label.trim() || !form.amount.trim()) {
      setFormError('Plan key, label, and price are required.')
      return false
    }

    setSubmitting(true)
    setFormError(null)
    try {
      const payload = formToPayload(form)
      if (editingId) {
        await adminService.updateBillingPlan(editingId, payload)
        notify.success('Billing plan updated')
      } else {
        await adminService.createBillingPlan(payload)
        notify.success('Billing plan created')
      }
      await refreshPlans()
      closeFormNow()
      return true
    } catch (err) {
      setFormError(serverMessage(err, 'Could not save billing plan.'))
      return false
    } finally {
      setSubmitting(false)
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    await saveForm()
  }

  const saveAndContinue = async () => {
    const action = pendingAction
    if (!action) return
    const saved = await saveForm()
    if (!saved) return
    setPendingAction(null)
    action()
  }

  const discardAndContinue = () => {
    const action = pendingAction
    setPendingAction(null)
    action?.()
  }

  const remove = async (plan: AdminBillingPlan) => {
    const ok = await confirm({
      title: `Delete "${plan.label}"?`,
      message: 'This plan will disappear from Premium checkout. Stripe product and price objects are archived when credentials are available.',
      confirmText: 'Delete plan',
      danger: true,
    })
    if (!ok) return

    setActingId(plan.id)
    try {
      await adminService.deleteBillingPlan(plan.id)
      await refreshPlans()
      if (editingId === plan.id) closeFormNow()
      notify.success('Billing plan deleted')
    } catch (err) {
      notify.error(serverMessage(err, 'Could not delete billing plan.'))
    } finally {
      setActingId(null)
    }
  }

  const requestRemove = (plan: AdminBillingPlan) => runOrPrompt(() => void remove(plan))

  const movePlan = async (plan: AdminBillingPlan, direction: -1 | 1) => {
    const from = plans.findIndex((item) => item.id === plan.id)
    const to = from + direction
    if (from < 0 || to < 0 || to >= plans.length) return

    const next = [...plans]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)

    setOrderingId(plan.id)
    setPlans(next.map((item, index) => ({ ...item, sortOrder: (index + 1) * 10 })))
    try {
      const ordered = await adminService.reorderBillingPlans(next.map((item) => item.id))
      setPlans(ordered)
      notify.success('Plan order saved')
    } catch (err) {
      await refreshPlans()
      notify.error(serverMessage(err, 'Could not save plan order.'))
    } finally {
      setOrderingId(null)
    }
  }

  const requestMovePlan = (plan: AdminBillingPlan, direction: -1 | 1) =>
    runOrPrompt(() => void movePlan(plan, direction))

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary sm:text-3xl">Billing plans</h1>
          <p className="mt-1 text-sm text-secondary">
            Manage plan cards, Stripe-backed products, and their Premium page order.
          </p>
        </div>
        <Button onClick={openCreate}>
          <PlusCircleIcon className="h-5 w-5" />
          New plan
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {editingId !== null && (
        <form
          onSubmit={submit}
          className="mb-6 flex flex-col gap-4 rounded-lg border border-elevated/40 bg-surface p-4 sm:p-5"
        >
          <div className="flex items-center gap-2">
            <CreditCardIcon className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-bold text-primary">{editingId ? 'Edit plan' : 'New plan'}</h2>
            {isDirty && <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-xs font-bold text-yellow-300">Unsaved</span>}
          </div>

          <section className="rounded-md border border-elevated/40 bg-base/30 p-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-secondary">Stripe billing</h3>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-primary">Plan key *</span>
                <input value={form.plan} onChange={(e) => set('plan', e.target.value)} className={inputCls} placeholder="student" />
                <span className="text-xs text-secondary">Used by checkout. Example: student, duo, family.</span>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-primary">Stripe product name *</span>
                <input value={form.label} onChange={(e) => set('label', e.target.value)} className={inputCls} placeholder="Premium Student" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-primary">Plan type</span>
                <select value={form.tier} onChange={(e) => set('tier', e.target.value as FormState['tier'])} className={inputCls}>
                  <option value="individual">Individual</option>
                  <option value="duo">Duo</option>
                  <option value="family">Family</option>
                  <option value="student">Student</option>
                </select>
              </label>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-primary">Premium seats</span>
                <input type="number" min={1} value={form.maxMembers} onChange={(e) => set('maxMembers', e.target.value)} className={inputCls} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-primary">Billing interval</span>
                <select value={form.interval} onChange={(e) => set('interval', e.target.value as FormState['interval'])} className={inputCls}>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-primary">Currency</span>
                <input value={form.currency} onChange={(e) => set('currency', e.target.value)} className={inputCls} maxLength={3} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-primary">Price</span>
                <input type="number" min={0} step="0.01" value={form.amount} onChange={(e) => set('amount', e.target.value)} className={inputCls} placeholder="10.00" />
              </label>
            </div>
          </section>

          <section className="rounded-md border border-elevated/40 bg-base/30 p-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-secondary">Premium card</h3>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-primary">Card title</span>
                <input value={form.cardTitle} onChange={(e) => set('cardTitle', e.target.value)} className={inputCls} placeholder="Student" />
              </label>
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-sm font-semibold text-primary">Badge / subtitle</span>
                <input value={form.discountLabel} onChange={(e) => set('discountLabel', e.target.value)} className={inputCls} placeholder="Discounted for students" />
              </label>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-primary">Perks</span>
                <textarea
                  value={form.perksText}
                  onChange={(e) => set('perksText', e.target.value)}
                  className={`${inputCls} min-h-28 resize-y`}
                  placeholder={'1 Premium account\nDiscount for eligible students\nCancel anytime'}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-primary">Fine print</span>
                <textarea
                  value={form.finePrint}
                  onChange={(e) => set('finePrint', e.target.value)}
                  className={`${inputCls} min-h-28 resize-y`}
                  placeholder="Terms apply. Cancel anytime."
                />
              </label>
            </div>
          </section>

          <section className="rounded-md border border-elevated/40 bg-base/30 p-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-secondary">Card colors</h3>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-primary">Card accent color</span>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={form.accentColor}
                    onChange={(e) => set('accentColor', e.target.value)}
                    className="h-10 w-12 shrink-0 rounded-md border border-elevated/50 bg-elevated p-1"
                  />
                  <input value={form.accentColor} onChange={(e) => set('accentColor', e.target.value)} className={inputCls} />
                </div>
              </label>
              <div className="rounded-md border border-elevated/40 bg-elevated/40 p-3">
                <p className="mb-2 text-xs font-semibold text-secondary">Preview</p>
                <div className="text-lg font-black" style={{ color: form.accentColor }}>
                  {form.cardTitle || 'Plan title'}
                </div>
                <div
                  className="mt-2 rounded-full px-4 py-2 text-center text-xs font-black"
                  style={{ backgroundColor: form.accentColor, color: readableTextColor(form.accentColor) }}
                >
                  Get Premium
                </div>
              </div>
            </div>
          </section>

          <label className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
            <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} className="h-4 w-4" />
            Show this plan on the Premium page
          </label>

          {formError && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-sm text-red-400">{formError}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? <Spinner size="sm" /> : 'Save plan'}
            </Button>
            <Button type="button" variant="outline" onClick={closeForm} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search plans..."
        className="mb-4 max-w-md"
        ariaLabel="Search billing plans"
      />
      {query.trim() && !loading && (
        <p className="mb-4 text-xs font-semibold text-secondary">Clear search to reorder plans.</p>
      )}

      {loading ? (
        <AdminTableSkeleton rows={5} columns={8} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-elevated/40 bg-surface">
          <table className="w-full min-w-[1020px]">
            <thead>
              <tr className="border-b border-elevated/40 text-left text-xs uppercase tracking-wider text-secondary">
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Seats</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Stripe IDs</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visiblePlans.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-secondary">
                    {query.trim() ? 'No billing plans match your search.' : 'No billing plans yet.'}
                  </td>
                </tr>
              )}
              {visiblePlans.map((plan) => {
                const index = plans.findIndex((item) => item.id === plan.id)
                const canReorder = !query.trim()
                return (
                <tr key={plan.id} className="border-b border-elevated/20 transition-colors hover:bg-elevated/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="w-6 text-sm font-bold text-secondary">{index + 1}</span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title="Move up"
                        aria-label={`Move ${plan.label} up`}
                        onClick={() => requestMovePlan(plan, -1)}
                        disabled={!canReorder || index <= 0 || orderingId !== null}
                      >
                        {orderingId === plan.id ? <Spinner size="sm" /> : <ArrowUpIcon className="h-4 w-4" />}
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title="Move down"
                        aria-label={`Move ${plan.label} down`}
                        onClick={() => requestMovePlan(plan, 1)}
                        disabled={!canReorder || index < 0 || index >= plans.length - 1 || orderingId !== null}
                      >
                        <ArrowDownIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-primary">{plan.label}</p>
                    <p className="text-xs text-secondary">{plan.plan} · {plan.source}</p>
                  </td>
                  <td className="px-4 py-3 text-sm capitalize text-secondary">{plan.tier}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-primary">{plan.displayPrice}</td>
                  <td className="px-4 py-3 text-sm text-secondary">{plan.maxMembers}</td>
                  <td className="px-4 py-3">
                    {plan.isActive ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-400">
                        <CheckCircleIcon className="h-4 w-4" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted">
                        <XCircleIcon className="h-4 w-4" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-secondary">
                    <p className="max-w-56 truncate">Product: {plan.stripeProductId || 'Will be created on save'}</p>
                    <p className="max-w-56 truncate">Price: {plan.stripePriceId || 'Will be created on save'}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(plan)}>
                        <PencilSquareIcon className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => requestRemove(plan)} disabled={actingId === plan.id}>
                        {actingId === plan.id ? <Spinner size="sm" /> : <TrashIcon className="h-4 w-4" />}
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-lg border border-elevated/50 bg-surface p-5 shadow-2xl">
            <h2 className="text-lg font-bold text-primary">Save changes?</h2>
            <p className="mt-2 text-sm text-secondary">
              This plan has unsaved edits. Save them before continuing, or discard the changes.
            </p>
            {formError && (
              <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3">
                <p className="text-sm text-red-400">{formError}</p>
              </div>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setPendingAction(null)} disabled={submitting}>
                Keep editing
              </Button>
              <Button type="button" variant="outline" onClick={discardAndContinue} disabled={submitting}>
                Discard
              </Button>
              <Button type="button" onClick={saveAndContinue} disabled={submitting}>
                {submitting ? <Spinner size="sm" /> : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
