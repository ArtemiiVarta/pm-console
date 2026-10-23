import { useCallback, useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Crown, Loader2, RefreshCw, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { ActionButton } from '@/components/ActionButton'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormField } from '@/components/FormField'
import { IconButton } from '@/components/IconButton'
import { PageHeader } from '@/components/PageHeader'
import { SectionCard } from '@/components/SectionCard'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/features/auth/useAuth'
import {
  ApiError,
  listPeople,
  removePerson,
  setPersonRole,
  type PeopleList,
  type PersonEntry,
  type Role,
} from '@/lib/api'
import { fieldAria } from '@/lib/fieldAria'
import { formatTimestampDate } from '@/lib/format'

const ROLES: { value: Role; label: string }[] = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
]

const personSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  role: z.enum(['admin', 'user']),
})
type PersonValues = z.infer<typeof personSchema>

const message = (error: unknown) => (error instanceof ApiError ? error.message : 'Something went wrong.')

export function AdminPage() {
  const myEmail = useAuth((state) => state.session?.user.email ?? '')
  const [people, setPeople] = useState<PeopleList | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyEmail, setBusyEmail] = useState<string | null>(null)

  const fetchPeople = useCallback(
    () =>
      listPeople().then(
        (list) => {
          setPeople(list)
          setLoadError(null)
        },
        (error: unknown) => setLoadError(message(error)),
      ),
    [],
  )

  useEffect(() => {
    void fetchPeople()
  }, [fetchPeople])

  const load = () => {
    setLoadError(null)
    void fetchPeople()
  }

  const changeRole = async (email: string, role: Role) => {
    setBusyEmail(email)
    try {
      const users = await setPersonRole(email, role)
      setPeople((current) => (current ? { ...current, users } : current))
      toast.success(`${email} is now ${role === 'admin' ? 'an admin' : 'a user'}`)
    } catch (error) {
      toast.error(message(error))
    } finally {
      setBusyEmail(null)
    }
  }

  const remove = async (email: string) => {
    setBusyEmail(email)
    try {
      const users = await removePerson(email)
      setPeople((current) => (current ? { ...current, users } : current))
      toast.success(`${email} no longer has access`)
    } catch (error) {
      toast.error(message(error))
    } finally {
      setBusyEmail(null)
    }
  }

  return (
    <>
      <PageHeader
        icon={ShieldCheck}
        title="Admin"
        description="Who can sign in to PM Console (Staging and Production) and what they can do."
      />
      <SectionCard icon={UserPlus} title="Add a person" description="They sign in with this Google account.">
        <AddPersonForm
          existing={people?.users ?? []}
          owner={people?.owner ?? ''}
          onAdded={(users) => setPeople((current) => (current ? { ...current, users } : current))}
        />
      </SectionCard>
      <SectionCard
        icon={Users}
        title="People"
        description="Changes apply within about 30 seconds, including to people already signed in."
        actions={
          <IconButton
            icon={RefreshCw}
            label="Reload people"
            tooltip="Reload the list"
            onClick={() => void load()}
          />
        }
      >
        {loadError ? (
          <p role="alert" className="text-sm text-danger">
            {loadError}
          </p>
        ) : !people ? (
          <p role="status" className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading…
          </p>
        ) : (
          <Table aria-label="People" containerClassName="rounded-lg border">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Email</TableHead>
                <TableHead className="w-44">Role</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="w-16 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">
                  {people.owner}
                  {people.owner === myEmail && <span className="text-muted"> (you)</span>}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="gap-1" title="The owner is always an admin">
                    <Crown className="h-3 w-3" aria-hidden />
                    Owner · Admin
                  </Badge>
                </TableCell>
                <TableCell className="text-muted">—</TableCell>
                <TableCell />
              </TableRow>
              {people.users.map((person) => (
                <PersonRow
                  key={person.email}
                  person={person}
                  isMe={person.email === myEmail}
                  busy={busyEmail === person.email}
                  onRoleChange={(role) => void changeRole(person.email, role)}
                  onRemove={() => void remove(person.email)}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </>
  )
}

function PersonRow({
  person,
  isMe,
  busy,
  onRoleChange,
  onRemove,
}: {
  person: PersonEntry
  isMe: boolean
  busy: boolean
  onRoleChange: (role: Role) => void
  onRemove: () => void
}) {
  const roleId = `role-${person.email}`
  return (
    <TableRow>
      <TableCell className="font-medium">
        {person.email}
        {isMe && <span className="text-muted"> (you)</span>}
      </TableCell>
      <TableCell>
        <Select value={person.role} onValueChange={(value) => onRoleChange(value as Role)} disabled={busy}>
          <SelectTrigger id={roleId} aria-label={`Role for ${person.email}`} className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((role) => (
              <SelectItem key={role.value} value={role.value}>
                {role.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-muted">
        {formatTimestampDate(person.addedAt)} · {person.addedBy}
      </TableCell>
      <TableCell className="text-right">
        <ConfirmDialog
          title={`Remove ${person.email}?`}
          description={
            isMe
              ? 'You will lose access to PM Console immediately.'
              : 'They lose access within about 30 seconds, even if signed in. Projects are not affected.'
          }
          confirmLabel="Remove"
          onConfirm={onRemove}
          trigger={
            <IconButton
              icon={Trash2}
              label={`Remove ${person.email}`}
              tooltip="Remove this person's access"
              disabled={busy}
            />
          }
        />
      </TableCell>
    </TableRow>
  )
}

function AddPersonForm({
  existing,
  owner,
  onAdded,
}: {
  existing: PersonEntry[]
  owner: string
  onAdded: (users: PersonEntry[]) => void
}) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PersonValues>({
    resolver: zodResolver(personSchema),
    defaultValues: { email: '', role: 'user' },
  })

  const submit = async (values: PersonValues) => {
    if (values.email === owner || existing.some((person) => person.email === values.email)) {
      setError('email', { message: 'This person already has access' })
      return
    }
    try {
      onAdded(await setPersonRole(values.email, values.role))
      toast.success(`Added ${values.email}`, { description: 'They can now sign in with Google.' })
      reset({ email: '', role: values.role })
    } catch (error) {
      setError('email', { message: message(error) })
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(submit)(event)}
      noValidate
      className="grid items-start gap-4 sm:grid-cols-[1fr_12rem_auto]"
    >
      <FormField id="person-email" label="Google account email" required error={errors.email?.message}>
        <Input
          id="person-email"
          type="email"
          autoComplete="off"
          placeholder="name@example.com"
          {...register('email')}
          {...fieldAria('person-email', errors.email?.message, false)}
        />
      </FormField>
      <FormField id="person-role" label="Role" helper="Admins can also manage people.">
        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="person-role" ref={field.ref} onBlur={field.onBlur}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormField>
      <div className="flex min-h-7 flex-col justify-end sm:pt-8">
        <ActionButton type="submit" icon={UserPlus} tooltip="Give this person access" disabled={isSubmitting}>
          {isSubmitting ? 'Adding…' : 'Add person'}
        </ActionButton>
      </div>
    </form>
  )
}
